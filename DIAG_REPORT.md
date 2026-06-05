# Диагностика gaurangers.com — Fri Jun  5 08:13:29 UTC 2026

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
    cache-control: public, max-age=0, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex
    server: cloudflare

## Какой JS грузит index.html (до purge)
    script (обычный /): /assets/index-896pWg7C.js

## ПРОБА cache-buster: /?_cb=NNN (другой ключ кэша → должен дойти до воркера)
    cf-cache-status: HIT
    cache-control:   public, max-age=0, must-revalidate
    script при cache-buster: /assets/index-896pWg7C.js
    'Аудио главы' в нём: 0  | 'initialTarget': 0

## /__fresh: index.html напрямую из origin (минуя кэш края)
    X-Asset-Status: 
    X-Asset-CC:     
    cf-cache-status:HIT
    JS в origin-index.html: /assets/index-896pWg7C.js

## Существуют ли файлы на сервере (HEAD)
    /assets/index-896pWg7C.js -> HTTP 200 (cf-cache-status: HIT)
    /assets/index-CoKgVYa4.js -> HTTP 200 (cf-cache-status: HIT)
    (896pWg7C = старый бандл на сайте; CoKgVYa4 = новый из сборки main)

## PURGE EVERYTHING
    success=false errors=[{"code":10000,"message":"Authentication error"}]

## Заголовки apex (после purge)
    HTTP/2 200 
    cf-cache-status: HIT
    cache-control: public, max-age=0, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex

    script после purge: /assets/index-896pWg7C.js
