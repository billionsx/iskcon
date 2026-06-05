# DEPLOY TRUTH — Fri Jun  5 08:34:34 UTC 2026

git HEAD: 1aa0699e834ca89dfdc915756f9b1d3f2a68e962

## build
    vite build exit = 0
    dist JS: index-CoKgVYa4.js 
    'Аудио главы' в собранном dist: 1
    'initialTarget' в dist: 1
    worker.ts содержит /__fresh: 1
    worker.ts содержит Cloudflare-CDN-Cache-Control: 3
    --- последние строки build.log ---
    [39m
    [32m✓[39m 125 modules transformed.
    rendering chunks...
    computing gzip size...
    [2mdist/[22m[32mindex.html                 [39m[1m[2m  0.73 kB[22m[1m[22m[2m │ gzip:   0.40 kB[22m
    [2mdist/[22m[2massets/[22m[35mindex-MobDqxtf.css  [39m[1m[2m  8.37 kB[22m[1m[22m[2m │ gzip:   2.52 kB[22m
    [2mdist/[22m[2massets/[22m[36mindex-CoKgVYa4.js   [39m[1m[2m357.38 kB[22m[1m[22m[2m │ gzip: 110.42 kB[22m
    [32m✓ built in 2.28s[39m

## wrangler deploy (реальный код возврата, БЕЗ конвейера)
    *** wrangler deploy exit = 1 ***
    --- полный вывод wrangler deploy ---
    
     ⛅️ wrangler 4.98.0
    ───────────────────
    
    Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md
    [33m▲ [43;33m[[43;30mWARNING[43;33m][0m [1m						The package "node:buffer" wasn't found on the file system but is built into node.[0m
    
      						Your Worker may throw errors at runtime unless you enable the "nodejs_compat" compatibility flag. Refer to [4mhttps://developers.cloudflare.com/workers/runtime-apis/nodejs/[0m for more details. Imported from:
      						 - ../../node_modules/.bun/@cloudflare+puppeteer@1.1.0+2b91fc17bf64bdfd/node_modules/@cloudflare/puppeteer/lib/esm/puppeteer/cloudflare/globalPatcher.js
      - ../../node_modules/.bun/@cloudflare+puppeteer@1.1.0+2b91fc17bf64bdfd/node_modules/@cloudflare/puppeteer/lib/esm/puppeteer/common/util.js
    
    
    🌀 Building list of assets...
    ✨ Read 21 files from the assets directory /home/runner/work/iskcon/iskcon/apps/web/dist
    🌀 Starting asset upload...
    No updated asset files to upload. Proceeding with deployment...
    Total Upload: 709.61 KiB / gzip: 140.12 KiB
    Your Worker has access to the following bindings:
    Binding                   Resource         
    env.DB (iskcon)           D1 Database      
    env.BROWSER               Browser Run      
    env.ASSETS                Assets           
    
    
    [31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mA request to the Cloudflare API (/accounts/d5cbe19470dc38599873eabfe148e6d1/workers/scripts/iskcon-web/versions) failed.[0m
    
      Uncaught Error: No such module "node:buffer".
        imported from "worker.js"
       [code: 10021]
      To learn more about this error, visit: [4mhttps://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021[0m
    
      
      If you think this is a bug, please open an issue at: [4mhttps://github.com/cloudflare/workers-sdk/issues/new/choose[0m
    
    
    🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler-2026-06-05_08-34-37_723.log"

## версии ПОСЛЕ deploy
    version aaa685f9-7325-4de9-b511-360402063717 created=2026-06-05T08:21:24.990636Z source=wrangler
    version 2cdeb02f-aff2-4bd8-9c8e-36040acd4e34 created=2026-06-05T08:21:24.686093Z source=wrangler
