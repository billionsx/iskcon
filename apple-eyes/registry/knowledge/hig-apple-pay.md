# знание · `hig-apple-pay`
Источник: https://developer.apple.com/design/human-interface-guidelines/apple-pay
Домены мандата: apple-pay
Нормативных положений: 40 (детерминированная выжимка, не пересказ)


## без раздела
- Use Apple Pay to sell physical goods like groceries, clothing, and appliances; for services such as club memberships, hotel reservations, and event tickets; and for donations.
- Apps and websites that accept Apple Pay display it as an available payment option and include an Apple Pay button in the purchasing flow that people use to bring up a payment sheet.
- Use to sell virtual goods in your app, such as premium content, and subscriptions for digital content.
- If the device doesn’t support Apple Pay, don’t present Apple Pay as a payment option.
- If you use Apple Pay APIs to find out whether someone has an active card in Wallet, you must make Apple Pay the primary — but not necessarily sole — payment option everywhere you use the APIs.
- Don’t separate Apple Pay into a different step or flow.
- Use Apple Pay buttons only to initiate payment or, when appropriate, the Apple Pay setup process.
- Don’t use Apple Pay buttons in any other way.
- If you use a custom button to start the Apple Pay payment process, make sure your custom button doesn’t display “Apple Pay” or the Apple Pay logo.
- In this scenario, you must let people know that you accept Apple Pay by displaying the graphic or referencing Apple Pay in text on the same page that displays your payment button.
- Use the Apple Pay mark graphic only to communicate that you accept Apple Pay.
- Never use it as a payment button or position it as a button.
- Don’t hide an Apple Pay button or make it appear unavailable.
- All websites that offer Apple Pay must include a privacy statement and adhere to the .
- Use your branding throughout the checkout experience and avoid opening different pages or windows.
- If Apple Pay is available, assume people want to use it.
- Use highlighting or warning text to identify missing information, and automatically navigate to the problematic field so people can correct it quickly and complete their purchase.
- Prefer checkout information from Apple Pay.
- Avoid requiring account creation before purchase.
- You can use the shipping method to supply a range of dates and times from which people can choose.
- Use line items to explain additional charges, discounts, pending costs, add-on donations, recurring payments, and future payments.
- Don’t use line items to show an itemized list of products that make up the purchase.
- Use the same business name people will see when they look for the charge on their bank or credit card statement.
- If you’re preauthorizing a specific amount, be sure the payment sheet accurately reflects this information.
- Websites that support Apple Pay can also use this icon during payment authorization — most notably during Handoff, when a person authorizes payment on a connected device — to provide visual reassurance that payment is going to the right place.
- Use these opportunities to check for data entry problems and to provide clear and consistent messaging.
- Avoid forcing compliance with your business logic.
- For example, if your app requires a five-digit zip code but someone enters a Zip+4 code, ignore the additional digits rather than asking for a correction.
- Aim to keep messages at 128 characters or fewer to avoid truncation.
- When such an event occurs, you must cancel any in-progress payment.
- Your app or website can use Apple Pay to request authorization for recurring payments.
- Before asking people to authorize a recurring payment, make sure they fully understand the billing frequency and any other terms of service.
- Use these line items to remind people what they’re authorizing.
- If no payment is required at authorization time, clearly disclose when billing will occur.
- For subscriptions with a trial period, use line items to display the trial amount (including $0 if free), the regular amount after the trial, and the date regular billing begins.
- Make sure people know the amount they’re being billed at the time of authorization.
- If you use this field, be concise and avoid duplicating information shown elsewhere in your app, website, or line items.
- can use Apple Pay to accept donations.
- Use a line item to identify a donation.
- You can reduce steps in the donation process by offering recommended donations, like $25, $50, $100.
