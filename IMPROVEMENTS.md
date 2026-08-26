# Improvements

## IDE Toolbar Logo

The logo next to the "EmptySock" text in the toolbar currently always renders the dark-background version of `assets/logo.svg`. When the IDE supports a light theme, the logo should switch variants:

- **Dark mode** → dark background logo (current, `#0f0f1a`–`#1a1a3e` circle fill)
- **Light mode** → light background logo (`#ece9ff`–`#dcd7ff` circle fill)

The SVG in `assets/logo.svg` already handles this via `@media (prefers-color-scheme)` when embedded inline or as an `<img>` in a browser context. However, the IDE's own theme toggle (if added) would need to stamp `data-theme` on the root and the SVG media query won't respond to that — it only responds to the OS preference.

**Fix when the time comes:** either serve two separate SVG files (`logo-dark.svg`, `logo-light.svg`) and swap them in the Toolbar based on the active theme token, or inline the SVG into the Toolbar component and drive the fill colors from CSS variables that the theme system already controls.
