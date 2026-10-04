import jwt from 'jsonwebtoken';
import { findProductByScheduleTask, getProduct, publishProduct, updateProduct } from './db.js';

function runtime(): { base: string; key: string; projectId: string; jwtSecret: string; oauthUrl: string } {
  const base = process.env.MANUS_API_URL;
  const key = process.env.MANUS_API_KEY;
  const projectId = process.env.MANUS_PROJECT_ID;
  const jwtSecret = process.env.MANUS_JWT_SECRET;
  const oauthUrl = process.env.MANUS_OAUTH_API_URL;
  if (!base || !key || !projectId || !jwtSecret || !oauthUrl) throw new Error('Scheduled publishing is not configured in this project runtime.');
  return { base: base.replace(/\/$/, ''), key, projectId, jwtSecret, oauthUrl: oauthUrl.replace(/\/$/, '') };
}

async function callHeartbeat<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const { base, key } = runtime();
  const response = await fetch(`${base}/webdevtoken.v1.WebDevService/${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'connect-protocol-version': '1' },
    body: JSON.stringify(body),
  });
  const data = await response.json() as T & { error?: { message?: string } | string };
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : data.error?.message;
    throw new Error(message || `Scheduling service could not ${method}.`);
  }
  return data;
}

function timeZoneOffset(timestamp: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  const asRecord = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const wallClockAsUtc = Date.UTC(Number(asRecord.year), Number(asRecord.month) - 1, Number(asRecord.day), Number(asRecord.hour), Number(asRecord.minute), Number(asRecord.second));
  return wallClockAsUtc - timestamp;
}

export function toUtcSchedule(localDateTime: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) throw new Error('Choose a valid date and time.');
  try { Intl.DateTimeFormat(undefined, { timeZone }); } catch { throw new Error('Choose a valid timezone.'); }
  const [date, time] = localDateTime.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let timestamp = Date.UTC(year, month - 1, day, hour, minute, 0);
  timestamp -= timeZoneOffset(timestamp, timeZone);
  timestamp -= timeZoneOffset(timestamp, timeZone) - timeZoneOffset(timestamp - timeZoneOffset(timestamp, timeZone), timeZone);
  const result = new Date(timestamp);
  if (Number.isNaN(result.getTime()) || result.getTime() < Date.now() + 60_000) throw new Error('Schedule a publishing time at least one minute in the future.');
  return result;
}

export async function scheduleProduct(productId: string, localDateTime: string, timeZone: string): Promise<{ scheduledAt: string; taskUid: string }> {
  const existing = await getProduct(productId);
  if (!existing) throw new Error('Product not found.');
  const utc = toUtcSchedule(localDateTime, timeZone);
  const cron = `0 ${utc.getUTCMinutes()} ${utc.getUTCHours()} ${utc.getUTCDate()} ${utc.getUTCMonth() + 1} *`;
  const result = existing.scheduledTaskUid
    ? await callHeartbeat<{ nextExecutionAt?: string }>('UpdateHeartbeatJob', { taskUid: existing.scheduledTaskUid, cronExpression: cron, callbackPath: '/api/scheduled/publish-product', callbackMethod: 'POST', callbackPayload: '{}', enable: true, description: `Publish Hollywood Shoe product ${productId} once at ${utc.toISOString()}.` }).then(() => ({ taskUid: existing.scheduledTaskUid! }))
    : await callHeartbeat<{ taskUid: string; nextExecutionAt?: string }>('CreateHeartbeatJob', { name: `hollywood-publish-${productId}`, cronExpression: cron, callbackPath: '/api/scheduled/publish-product', callbackMethod: 'POST', callbackPayload: '{}', description: `Publish Hollywood Shoe product ${productId} once at ${utc.toISOString()}.` });
  if (!result.taskUid) throw new Error('The scheduling service did not return a task identity.');
  await updateProduct(productId, { status: 'scheduled', scheduledAt: utc.toISOString(), scheduleTimezone: timeZone, scheduledTaskUid: result.taskUid });
  return { scheduledAt: utc.toISOString(), taskUid: result.taskUid };
}

export async function cancelProductSchedule(taskUid: string): Promise<void> {
  await callHeartbeat('DeleteHeartbeatJob', { taskUid });
}

export async function executeScheduledPublish(cookieToken: string | undefined): Promise<{ productId: string; status: string }> {
  const { jwtSecret, projectId, oauthUrl } = runtime();
  if (!cookieToken) throw new Error('Missing platform schedule identity.');
  const claims = jwt.verify(cookieToken, jwtSecret, { algorithms: ['HS256'] }) as { openId?: string; appId?: string };
  if (!claims.openId?.startsWith('cron_') || claims.appId !== projectId) throw new Error('Invalid platform schedule identity.');
  const infoResponse = await fetch(`${oauthUrl}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jwt_token: cookieToken, project_id: projectId }),
  });
  const info = await infoResponse.json() as { taskUid?: string; error?: { message?: string } };
  if (!infoResponse.ok || !info.taskUid) throw new Error(info.error?.message || 'Could not resolve this scheduled job.');
  const product = await findProductByScheduleTask(info.taskUid);
  if (!product) throw new Error('This scheduled job is not associated with a Hollywood Shoe product.');
  if (product.status === 'published') {
    await cancelProductSchedule(info.taskUid);
    await updateProduct(product.id, { scheduledTaskUid: null, scheduleTimezone: null });
    return { productId: product.id, status: 'already_published' };
  }
  await publishProduct(product.id);
  await cancelProductSchedule(info.taskUid);
  await updateProduct(product.id, { scheduledTaskUid: null, scheduleTimezone: null });
  return { productId: product.id, status: 'published' };
}
