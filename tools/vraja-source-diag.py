import urllib.request, urllib.error
URL = "https://vrajapedia.com/ru/places/mathura/pippaleshvara-mahadev/"
UA = "Mozilla/5.0 (compatible; iskcon-one-love/1.0)"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        print("::notice::РЕДИРЕКТ %d -> %s" % (code, newurl))
        return None

op = urllib.request.build_opener(NoRedirect)
try:
    r = op.open(urllib.request.Request(URL, headers={"User-Agent": UA}), timeout=20)
    body = r.read().decode("utf-8", "replace")
    print("::notice::код %d, длина %d" % (r.status, len(body)))
    import re
    m = re.search(r"[-+]?\\d{1,2}\\.\\d{4,}\\s*,\\s*[-+]?\\d{1,3}\\.\\d{4,}", body)
    print("::notice::координаты в теле: %s" % (m.group(0) if m else "НЕТ"))
except urllib.error.HTTPError as e:
    print("::notice::HTTP %d, Location: %s" % (e.code, e.headers.get("Location")))
except Exception as e:
    print("::notice::ошибка %s: %s" % (type(e).__name__, str(e)[:90]))
