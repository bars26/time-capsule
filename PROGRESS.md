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
7. **Swap'lara Builder Code (✅ CANLI):** swap + approve işlemlerinin calldata'sına
   `BUILDER_CODE_SUFFIX` ekleniyor (SwapBox.tsx), böylece swap'lar da base.dev'e atfediliyor.
   Zincirde doğrulandı (tx 0xa62c…1235 calldata sonunda suffix var). ERC-8021 mantığı, router revert etmiyor.
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
3. **x402 — AI mesaj yazma (✅ CANLIDA, BİTTİ):**
   - Kapsül ekranında "✨ AI ile yaz · $0.05" → cüzdan gassız EIP-3009 imzasıyla $0.05 USDC öder,
     OpenAI (gpt-4o-mini) mektubu üretir, mesaj alanına yazılır. Builder Code (bc_sfeb71ad) ekli.
   - ⚠️ Mimari notu: middleware (Edge) KULLANILMIYOR. Next.js middleware Edge'de çalışıyor ve
     x402 paketleri (bazaar vb. Node modülleri) Edge'de yüklenemiyor → Vercel build patlıyordu.
     Çözüm: `app/api/ai-message/route.ts` içinde `withX402` (route handler sarmalayıcı, `runtime="nodejs"`).
     Bonus: `withX402` ödemeyi yalnızca handler başarılı (status<400) dönerse tahsil ediyor —
     AI hata verirse kullanıcıdan para alınmıyor. (middleware.ts silindi.)
   - Sunucu CANLI ve doğrulandı, endpoint 402 dönüyor; uçtan uca lokalde+canlıda test edildi.
   - Paketler: `@x402/next @x402/evm @x402/core @x402/extensions @coinbase/x402 @x402/fetch`
     `--legacy-peer-deps` ile kuruldu (Next 15, @x402/next next>=16 istiyor — peer uyarısı atlandı).
   - .env.local: CDP_API_KEY_ID/SECRET (Ed25519), X402_PAY_TO, AI_API_KEY, AI_MODEL=gpt-4o-mini.
   - ✅ İstemci tarafı CANLI (lokalde test edildi, çalışıyor): `app/components/AiMessageButton.tsx`
     — kapsül ekranında "✨ AI ile yaz · $0.05" butonu; bağlı cüzdan gassız EIP-3009 imzasıyla
     $0.05 USDC öder, dönen mektup mesaj alanına yazılır. OpenAI billing yüklendi (gpt-4o-mini,
     istek başına ~$0.0002 → bol marj).
   - ⏳ CANLIYA ÇIKIŞ İÇİN KALAN:
       1. `.npmrc` ekle: `legacy-peer-deps=true` (Vercel build'i peer çakışmasında patlamasın).
       2. Vercel → Settings → Environment Variables: CDP_API_KEY_ID, CDP_API_KEY_SECRET,
          X402_PAY_TO, AI_API_KEY, AI_MODEL (Production).
       3. Commit + push (middleware.ts, app/api/ai-message, AiMessageButton.tsx, page.tsx,
          package.json, package-lock.json, .npmrc).
   - İyileştirme (opsiyonel): AI başarısızsa $0 tahsil et (x402 `upto` şeması).
   - **NFT mint** drop'ları (mint başına fee) — sırada.
   - ~~GM/GN günlük onchain buton~~ ✅ YAPILDI (yukarı bak).
   - Opsiyonel: GM/GN owner'ını smart wallet'a `transferOwnership` ile taşıyıp fee'leri tek cüzdanda toplama.
4. **Opsiyonel:** her sabah otomatik "dün ne kadar fee kazandım" özeti (scheduled task).

## Çalıştırma / Deploy
- Lokal: `cd ~/base/time-capsule && npm run dev` → http://localhost:3000
- Deploy: değişiklikleri `git add … && git commit … && git push` → Vercel otomatik yayınlar.

## Notlar
- Bu konuşma uzun vadeli bir proje; acele yok, aşamalı ilerliyoruz.
- Türkçe iletişim tercih ediliyor.
