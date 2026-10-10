

# Men’s Product-Grid Reference Refinement

## Preservation boundary
Only the existing `/mens` collection presentation was refined. Home JSX, Home media, Home interactions, Home animations, Home footer, Home-visible styling, product APIs, and existing Men’s detail routing were preserved.

## Reference-led design decisions
The supplied reference is followed as a clean luxury-retail grid: compact collection heading, minimal utility controls, large neutral image wells, four desktop columns where space permits, narrow dividers, upper-right heart controls, and product name/INR price immediately below each image. The prior image-heavy lens rail was removed from the visible flow so products arrive sooner.

## Data and interaction decisions
The real published Men’s inventory remains the source of truth. All three published records retain their real approved images, names, prices, sale prices, and badges. The product schema was inspected and contains no color-variant model; the UI states this limitation instead of fabricating swatches. Hearts are implemented as a reversible device-local wishlist using `localStorage`, because no customer wishlist backend exists. Product image/name links retain the existing `/mens/:id` detail flow.

## Responsive decisions
The grid is four columns on wide desktop, three columns at intermediate widths, and two columns on mobile. Controls wrap at small widths, image wells remain consistent, hover scale stays subtle, and the page avoids new viewport-width overflow hacks. The shared stylesheet is preserved and the new rules are appended as Men’s-only overrides.

## Verification evidence
The production build passed. Real Men’s product images returned HTTP 200 through Preview. The browser verified the visible grid, local heart state persistence after reload, and navigation from the first product card to its direct detail route. Desktop and mobile screenshots were captured after the shared CSS restoration.
