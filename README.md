# RENAX Customer

RENAX Customer is the customer-facing RENAX app for booking deliveries, tracking shipments in real time, funding wallets, and getting support without touching internal ops tooling. It is the clean front door to the RENAX logistics network across mobile and web.

## What this app handles

- Customer sign-in and role-gated access
- Shipment booking for standard deliveries and agro transport
- Live tracking across local and terminal-relay delivery flows
- Wallet funding, payment methods, withdrawal requests, and payment history
- Customer notifications tied to shipment milestones
- Support ticket creation and self-service help for active shipments

## Product highlights

- Fast booking flow for parcels, freight, and custom delivery needs
- Agro shipment mode with produce category, tonnage, insurance, and cold-chain options
- Real-time tracking with shipment stages, terminal handoffs, proofs, and rider visibility
- Wallet and payments workspace with cards, bank accounts, top-ups, and withdrawals
- Web landing experience that routes customers into booking, tracking, wallet, and support journeys
- Notification center that deep-links customers back into the shipment they need to act on

## Stack

- Expo + React Native + Expo Router
- JavaScript and TypeScript
- Supabase Auth, Postgres, and Realtime
- React Native Maps, Leaflet, and web mapping support
- i18n support for multilingual customer-facing flows

## Project structure

- `app/` app entrypoint and auth gating
- `components/` landing, auth, dashboard shell, notifications, and map surfaces
- `components/tabs/` booking, agro, tracking, payments, settings, history, and support flows
- `utils/` customer metrics, notifications, routing, wallet helpers, and QR payload utilities
- `assets/` customer-facing brand assets and illustrations

## Local setup

1. Install dependencies.
   ```bash
   npm install
   ```
2. Create a `.env` file in the repo root.
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Start the app.
   ```bash
   npm run start
   ```

Helpful commands:

```bash
npm run web
npm run ios
npm run android
npm run lint
```

## Backend expectations

This app expects a Supabase backend with customer and logistics tables such as `profiles`, `shipments`, `shipment_events`, `shipment_stage_proofs`, `shipment_stage_suggestions`, `terminals`, `rider_locations`, `customer_wallets`, `wallet_transactions`, `wallet_withdrawals`, `payment_methods`, `bank_accounts`, `customer_notifications`, `customer_settings`, `support_tickets`, and `notification_delivery_queue`.

## Related RENAX repos

- [RENAX Admin](https://github.com/chimzyfire-ship-it/Renax-Admin)
- [RENAX Rider](https://github.com/chimzyfire-ship-it/Renax-Rider-)

## Summary

RENAX Customer focuses on the full client journey: booking, paying, tracking, receiving updates, and getting help fast. It gives RENAX a polished customer experience without exposing internal dispatch complexity.
