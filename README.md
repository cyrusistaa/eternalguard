# Cyrus Guard Bot

Railway ve GitHub uyumlu, `discord.js` tabanli bir Discord guard botu.

Ozellikler:

- Railway Variables uzerinden token ve ID okur
- Durum kisminda yayin yapiyormus gibi `Developed By Cyrus` yazar
- Hedef ses kanalina girer, kulakligi kapali ve mikrofonu acik kalir
- Izinsiz kanal/rol islemleri, ban ve bot ekleme gibi hareketleri denetler
- Guard log kanalina detayli bildirim gonderir
- Slash komutlarla kisi bazli guard yetkisi tanimlanir
- Railway Postgres baglanirsa guard yetkileri kalici saklanir

## Slash Komutlar

- `/guardekle uye:@Cyrus yetki:kick`
- `/guardcikar uye:@Cyrus yetki:kick`
- `/guardliste`
- `/guardgoster uye:@Cyrus`

Yetki tipleri:

- `kick`
- `ban`
- `bot`
- `channel_delete`
- `channel_update`
- `role_delete`
- `role_update`
- `full`

## Railway Variables

Asagidaki degiskenleri Railway paneline ekle:

- `DISCORD_TOKEN`
- `GUILD_ID`
- `VOICE_CHANNEL_ID`
- `GUARD_LOG_CHANNEL_ID`
- `OWNER_ID`
- `SAFE_USER_IDS`
- `STATUS_TEXT`
- `STREAM_URL`
- `DATABASE_URL` (`Railway Postgres` kullanacaksan)

## Kurulum

1. GitHub'a bu klasoru yukle
2. Railway'de GitHub reposunu bagla
3. `Variables` kismina `.env.example` icindeki degerleri gir
4. Mumkunse Railway Postgres ekle ve `DATABASE_URL` degiskenini bagla
5. Botu deploy et

## Yerelde Calistirma

```bash
npm install
npm start
```

## Not

Guard sistemi audit log verisine dayandigi icin Discord tarafindaki kisa gecikmelerden etkilenebilir.
`DATABASE_URL` yoksa bot JSON dosyasina duser; bu da Railway restart sonrasi kalici olmayabilir.
