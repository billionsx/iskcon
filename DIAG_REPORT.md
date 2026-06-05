# Диагностика gaurangers.com — Fri Jun  5 08:05:52 UTC 2026

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
    script: /assets/index-896pWg7C.js
    содержит 'Аудио главы — скоро' (меню главы, b7939c7): 0
    содержит 'initialTarget' (роутинг 80b014a): 0
    содержит 'run_worker_first-маркер? (no-store)': n/a

## PURGE EVERYTHING
    success=false errors=[{"code":10000,"message":"Authentication error"}]

## Заголовки apex (после purge)
    HTTP/2 200 
    cf-cache-status: HIT
    cache-control: public, max-age=0, must-revalidate
    x-robots-tag: noindex, nofollow, noarchive, nosnippet, noimageindex

    script после purge: /assets/index-896pWg7C.js
