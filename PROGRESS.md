# Time Capsule — İlerleme & Kaldığımız Yer

_Son güncelleme: 2026-06-24_

Bu dosya, Claude ile birlikte yürüttüğümüz "Base'de fee geliri" çalışmasının
durumunu özetler. Yeni bir oturuma başlarken bunu okutmak yeterli.

## Proje
- Uygulama: **Time Capsule** (geleceğe onchain, şifreli mesaj kapsülleri)
- Canlı adres (primary): **https://timecapsule-base.vercel.app**
  - `basecapsule.vercel.app` ve `time-capsule-nu-tan.vercel.app` → buraya redirect
- Repo: github.com/bars26/time-capsule (branch `main`, Vercel otomatik deploy)
- Stack: Next.js 15 (app router) + wagmi/viem + RainbowKit + OnchainKit + next-intl

## Cüzdanlar
- **Fee alıcı (gelir adresi):** `0x9f417535486848942add6CF58Ac7E841976bfD3B` (Base Account / smart wallet)
- Swap testlerinde bağlanan EOA: `0x4F...06bf` (Coinbase üzerinden ana cüzdan)
- Not: smart wallet ile uğraşmama kararı verildi; fee yine smart wallet adresine gidiyor.

## TAMAMLANANLAR ✅
1. **Kapsül mint fee** (0.0001 ETH, payable `createCapsule`) + **withdraw** — zaten vardı.
2. **Builder Code** (`bc_sfeb71ad`, dataSuffix olarak) — zaten entegre (lib/contract.ts).
3. **Swap özelliği (YENİ, CANLI):** KyberSwap Aggregator üzerinden token takası.
   - Affiliate fee **%0.3**, fee alıcı = yukarıdaki cüzdan. Fee'nin düştüğü doğrulandı.
   - Fee parametreleri sunucu tarafında eklenir (kullanıcı kaldıramaz).
   - 13 token, **aranabilir** token seçici, **fiyat etkisi + min. alınacak**, bakiye + **Max**.
   - ETH için approval yok; ERC-20 girişte otomatik approve.
4. **Gömülü hızlı takas:** kapsül oluşturma ekranında "💱 Low on ETH? Quick swap" kutusu.
5. **Temiz domain** + kodda SITE_URL ve farcaster.json URL'leri yeni adrese güncellendi.
6. **Onchain GM/GN (YENİ, CANLI):** günlük selam butonu, streak takibi, 0.00001 ETH fee.
   - Kontrat (Base): `0x1d7D08a03D4c9C6375ca1363Eba384b14a1Ac88D`
   - **Owner = deploy eden EOA** `0x4f8...406bf`; biriken fee `withdraw()` ile bu cüzdana çekilir.
   - Sayfa: `/gm`. Kontrat kaynağı: `contracts/GmGn.sol`, config: `lib/gmgn.ts`.
   - Builder Code suffix her selama ekleniyor.

### İlgili dosyalar
- `lib/swap.ts` — fee config (SWAP_FEE_BPS=30, SWAP_SLIPPAGE_BPS=50, SWAP_FEE_RECIPIENT), token listesi, tipler
- `app/api/swap/route.ts` — KyberSwap proxy (GET quote / POST build)
- `app/components/SwapBox.tsx` — tekrar kullanılabilir swap widget'ı
- `app/components/TokenPicker.tsx` — aranabilir token seçici
- `app/swap/page.tsx` — bağımsız /swap sayfası (SwapBox sarmalayıcı)
- `app/page.tsx` — kapsül ekranına gömülü SwapBox

## YAPILACAKLAR / SIRADAKİLER
1. ~~Farcaster / Base mini-app imzası~~ ✅ YAPILDI — yeni domain için accountAssociation
   imzalandı (FID 243127), frame/miniapp birebir aynı yapıldı, manifest tool yeşil.
   base.dev App Domains'te `timecapsule-base.vercel.app` Primary olarak ekli.
2. **Swap parlatma (opsiyonel):** dropdown'u yukarı doğru açma seçeneği, daha çok token,
   adresle özel token ekleme, USD ile giriş.
3. **Büyük fikirler (fikir aşamasında):**
   - **x402** premium aksiyon (kullanım başına USDC; örn. "kapsülü erken aç", "özel tema", "AI mesaj").
   - **NFT mint** drop'ları (mint başına fee).
   - ~~GM/GN günlük onchain buton~~ ✅ YAPILDI (yukarı bak).
   - Opsiyonel: GM/GN owner'ını smart wallet'a `transferOwnership` ile taşıyıp fee'leri tek cüzdanda toplama.
4. **Opsiyonel:** her sabah otomatik "dün ne kadar fee kazandım" özeti (scheduled task).

## Çalıştırma / Deploy
- Lokal: `cd ~/base/time-capsule && npm run dev` → http://localhost:3000
- Deploy: değişiklikleri `git add … && git commit … && git push` → Vercel otomatik yayınlar.

## Notlar
- Bu konuşma uzun vadeli bir proje; acele yok, aşamalı ilerliyoruz.
- Türkçe iletişim tercih ediliyor.
