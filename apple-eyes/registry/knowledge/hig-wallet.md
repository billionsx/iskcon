# знание · `hig-wallet`
Источник: https://developer.apple.com/design/human-interface-guidelines/wallet
Домены мандата: apple-wallet
Нормативных положений: 40 (детерминированная выжимка, не пересказ)


## без раздела
- People use their cards and passes in Wallet to make Apple Pay purchases, track their orders, confirm their identity, and streamline activities like boarding a plane, attending a concert, or receiving a discount.
- For frequent, predictable actions like checking in for a flight, you can add passes in the background after a person grants a one-time authorization, so they don’t need to tap an Add to Apple Wallet button each time.
- If people decline your suggestion, don’t ask them again.
- If your app generates multiple passes, like boarding passes for a multi-connection flight, add all passes at once so people don’t have to add each one individually.
- Always get permission before deleting passes from Wallet.
- Ideally, passes automatically appear when they’re needed so people don’t have to manually locate them.
- Physical passes don’t typically change, but a digital pass can reflect changes as they happen.
- Use change messages only for updates to time-critical information.
- For example, people need to know when there’s a gate change for a flight, but they don’t need to know when a customer service phone number changes.
- Never use a change message for marketing or other noncritical communication.
- For poster event and semantic boarding passes, semantic tags are required and enable automatic layout.
- Use Pass Designer to design and preview passes for Apple Wallet.
- Don’t put essential information in elements that might be unavailable on certain devices, and avoid adding padding to images; for example, watchOS crops white space from some images.
- Use the rest of the pass front for information people need quick access to.
- Place details people don’t need often on the additional pass information sheet.
- Use brand colors and visual elements like images, icons, and full-art backgrounds to help people recognize your pass at a glance.
- Use language that works on any device.
- Passes can appear on multiple devices, so use text that makes sense everywhere.
- Use semantic tags for airline boarding passes; use pass fields for all other transit types.
- Typically each pass corresponds to a specific event, but you can also use a single pass for multiple events, as with a season ticket.
- Non-poster style event tickets use standard pass fields and can use a background image and thumbnail.
- The poster generic pass style features a full background image and a pass field layout distinct from other pass styles, offering a flexible option that supports a wide range of use cases.
- It’s not tied to a specific category, so you can use it whenever another pass style doesn’t fit.
- The generic style is for passes that don’t fit the other categories, such as a gym membership card or coat-check claim ticket.
- Create pass images in PNG format in @2x and @3x format.
- Embedded text isn’t accessible and may not be visible if images don’t display on all devices.
- For text information, use text fields and semantic tags instead.
- Use Pass Designer or corresponding APIs to add barcodes rather than embedding them in pass images.
- To make downloads as fast as possible, use the smallest image files that still look great.
- You can use your app icon or design a separate one.
- Avoid inner drop shadows on logo artwork.
- The system automatically applies rounded corners, so you don’t need to round them.
- Avoid embedding text in the strip image.
- Thumbnails are square — use rounded corners on your artwork and export as a transparent PNG.
- The schema defines the properties you use to provide order data like product descriptions, order status, contact information, and shipping and pickup details, including estimated arrival dates, addresses, tracking numbers, and pickup instructions.
- For example, when a customer completes an Apple Pay transaction in your app or website, use (app) or (web) to automatically add the order to Wallet.
- In iOS 17 and later, you can use to display the system-provided Track with Apple Wallet button in relevant areas of your app or website — such as in pages for order confirmation, status, or tracking — or in emails to customers.
- The system displays your logo image in the dashboard and detail view, so you want to make sure that people can instantly recognize it at various sizes.
- Use the PNG or JPEG format to create a logo image that measures 300x300 pixels.
- To help ensure that your logo image renders correctly, be sure to use a nontransparent background.
