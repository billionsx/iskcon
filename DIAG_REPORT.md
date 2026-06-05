# Диагностика gaurangers.com — Fri Jun  5 08:44:58 UTC 2026

zone=708c4b79858d2ab38668e1b86f940025

## DNS-записи
- CNAME _domainconnect.gaurangers.com -> _domainconnect.gd.domaincontrol.com proxied=true
- TXT _dmarc.gaurangers.com -> "v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;" proxied=false
- AAAA api.gaurangers.com -> 100:: proxied=true
- AAAA gaurangers.com -> 100:: proxied=true
- AAAA www.gaurangers.com -> 100:: proxied=true

## Worker custom domains (кто из воркеров держит хост)
- ethnomir.app -> ethnomir-app/production
- api.gaurangers.com -> iskcon-api/production
- gaurangers.com -> iskcon-web/production
- www.gaurangers.com -> iskcon-web/production

## Cache Rules / rulesets
    (правил кэширования в зоне нет — HTML кэшируется по умолчанию/настройкам)

## Pages-проекты и их домены

## Заголовки ответа apex (до purge)
    HTTP/2 200 
    cf-cache-status: HIT
    cache-control: no-store, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex
    server: cloudflare

## Какой JS грузит index.html (до purge)
    script (обычный /): /assets/index-CoKgVYa4.js

## ПРОБА cache-buster: /?_cb=NNN (другой ключ кэша → должен дойти до воркера)
    cf-cache-status: HIT
    cache-control:   no-store, must-revalidate
    script при cache-buster: /assets/index-CoKgVYa4.js
    'Аудио главы' в нём: 1  | 'initialTarget': 1

## /__fresh: index.html напрямую из origin (минуя кэш края)
    --- все заголовки /__fresh ---
    HTTP/2 200 
    content-type: text/plain; charset=utf-8
    cache-control: no-store
    x-asset-cc: public, max-age=0, must-revalidate
    x-asset-etag: "550162fe0149e019fb62c0b4df949c78"
    x-asset-status: 200
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex
    JS в origin-index.html: /assets/index-CoKgVYa4.js

## ПРОБА свежий путь (никогда не запрашивался → кэш не перехватит → отработает воркер)
    путь: /__probe-1780649100-27707
    HTTP/2 200 
    cf-cache-status: HIT
    cache-control: no-store, must-revalidate
    cdn-cache-control: no-store
    cloudflare-cdn-cache-control: no-store
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex
    JS в ответе: /assets/index-CoKgVYa4.js
    'Аудио главы': 1  | 'initialTarget': 1
    (есть cdn-cache-control: no-store → активен НОВЫЙ воркер; JS=CoKgVYa4 → новые ассеты)

## iskcon-web: активная маршрутизация + попытка перевода на 100%
    активный деплой версии→%:
      f89b0a70-3941-423a-b732-ff6747bfaf07 -> 100%
    новейшая версия:  f89b0a70-3941-423a-b732-ff6747bfaf07
    активная версия:  f89b0a70-3941-423a-b732-ff6747bfaf07
    перевод newest→100%: {"success":true,"errors":[]}

## после перевода: свежий путь ещё раз
    cf-cache-status: HIT
    cache-control: no-store, must-revalidate
    cdn-cache-control: no-store
    cloudflare-cdn-cache-control: no-store
    JS: /assets/index-CoKgVYa4.js

## Существуют ли файлы на сервере (HEAD)
    /assets/index-896pWg7C.js -> HTTP 200 (cf-cache-status: HIT)
    /assets/index-CoKgVYa4.js -> HTTP 200 (cf-cache-status: HIT)
    (896pWg7C = старый бандл на сайте; CoKgVYa4 = новый из сборки main)

## PURGE EVERYTHING
    success=false errors=[{"code":10000,"message":"Authentication error"}]

## Заголовки apex (после purge)
    HTTP/2 200 
    cf-cache-status: HIT
    cache-control: no-store, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex

    script после purge: /assets/index-CoKgVYa4.js
