# знание · `hig-live-activities`
Источник: https://developer.apple.com/design/human-interface-guidelines/live-activities
Домены мандата: динамические-острова
Нормативных положений: 40 (детерминированная выжимка, не пересказ)


## без раздела
- As a result, your Live Activity must support: In iOS and iPadOS, your Live Activity appears throughout the system using these presentations.
- In this presentation, use a layout similar to the expanded presentation.
- When you alert people about Live Activity updates on devices that don’t support the Dynamic Island, the Lock Screen presentation briefly appears as a banner that overlays the Home Screen or other apps.
- When someone taps it, it transitions to the Lock Screen presentation, scaled up by 2x to fill the screen.
- Live Activities work best for tracking short to medium duration activities that don’t exceed eight hours.
- Don’t use a Live Activity to display ads or promotions .
- Avoid displaying sensitive information.
- Live Activities are prominently visible and could be viewed by casual observers; for example, on the Lock Screen or in the Always-On display.
- Don’t use the entire app icon.
- Don’t add elements to your app that draw attention to the Dynamic Island.
- Your Live Activity appears in the Dynamic Island while your app isn’t in use, and other items can appear in the Dynamic Island when your app is open.
- Use large, heavier-weight text — a medium weight or higher.
- Use small text sparingly and make sure key information is legible at a glance.
- Adjust element size and placement for efficient use of space.
- Use familiar layouts for custom views and layouts.
- Templates with default system margins and recommended text sizes are available in .
- Use consistent margins and concentric placement.
- Use even, matching margins between rounded shapes and the edges of the Live Activity, including corners, to ensure a harmonious fit.
- When separating a block of content, place it in an inset container shape or use a thick line.
- Don’t draw content all the way to the edge of the Dynamic Island.
- When there’s less information to show, reduce the height of the Live Activity to only use the space needed for the content.
- However, you can use a custom background color for the Lock Screen presentation.
- If you set a custom background color or image for the Lock Screen presentation, ensure sufficient contrast — especially for tint colors on devices that feature an Always-On display with reduced luminance.
- Use color to express the character and identity of your app.
- Live Activities in the Dynamic Island use a black opaque background.
- In addition to extending and contracting transitions, Live Activities use system and custom animations with a maximum duration of two seconds.
- Note that the system doesn’t perform animations on Always-On displays with reduced luminance.
- Use animations to reinforce the information you’re communicating and to bring attention to updates.
- For example, a sports app might use numeric content transitions for score changes or fade a timer in and out when it reaches zero.
- Content updates can require a change to your Live Activity layout — for example, when it expands to fill the screen in StandBy or when more information becomes available.
- Try to avoid overlapping elements.
- Sometimes, it’s best to animate out certain elements and then re-animate them in at a new position to avoid colliding with other parts of your transition.
- For example, when animating items in lists, only animate the element that moves to a new position and use fade-in-and-out transitions for the other list items.
- Make sure tapping the Live Activity opens your app at the right location.
- Take people directly to related details and actions — don’t make them navigate to find relevant information.
- If you offer interactivity, prefer limiting it to a single element to help people avoid accidentally tapping the wrong control.
- Alert people only for essential updates that require their attention.
- Alerts also show the expanded presentation in the Dynamic Island or a banner on devices that don’t support the Dynamic Island.
- To ensure your Live Activities provide the most value, avoid alerting people too often or with updates that aren’t crucial, and don’t use push notifications alongside Live Activities for the same updates.
- Instead of creating separate Live Activities people need to jump between to track different events, prefer a single Live Activity that uses a dynamic layout and rotates through events.
