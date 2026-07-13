import urllib.request, urllib.error
URL = "https://vrajapedia.com/ru/places/mathura/pippaleshvara-mahadev/"
UA = "Mozilla/5.0 (compatible; iskcon-one-love/1.0)"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        print("РЕДИРЕКТ %d → %s" % (code, newurl))
        return None

op = urllib.request.build_opener(NoRedirect)
try:
    r = op.open(urllib.request.Request(URL, headers={"User-Agent": UA}), timeout=20)
    print("код:", r.status, "| длина:", len(r.read()))
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print("Location:", e.headers.get("Location"))
except Exception as e:
    print("ошибка:", type(e).__name__, str(e)[:80])
