# Диагностика gaurangers.com — Fri Jun  5 08:22:50 UTC 2026

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
    --- все заголовки /__fresh ---
    HTTP/2 200 
    content-type: text/html
    cf-cache-status: HIT
    cache-control: no-store, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex
    JS в origin-index.html: /assets/index-896pWg7C.js

## iskcon-web: версии и активный деплой
    deploy 719d3c7c-34e3-4986-9796-c44ab9d3974b created=2026-06-05T08:21:24.990636Z strategy=percentage
    deploy 0e270c8b-e35b-44d1-b555-d503b7dc5cdf created=2026-06-05T08:21:24.686093Z strategy=percentage
    version 147 created=2026-06-05T08:21:24.990636Z tag=secret
    version 146 created=2026-06-05T08:21:24.686093Z tag=secret
    version 145 created=2026-06-05T08:12:55.441339Z tag=secret

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
