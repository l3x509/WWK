#!/usr/bin/env python3
"""Adds GA4 click events to every blog article: blog_title_click (links to /title),
blog_finder_click (links to the finder), blog_guide_click (links to other guides).
Safe to re-run: files containing the marker are skipped.   Usage: python3 tools/add_blog_events.py public/blog
"""
import sys, pathlib
MARK = "<!--wwk-events-->"
JS = MARK + """
<script>
(function(){
  function send(n,p){ try{ if(window.gtag) gtag('event',n,p); }catch(e){} }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]'); if(!a) return;
    var h=a.getAttribute('href')||'', page=location.pathname.replace(/^\\/blog\\//,'').slice(0,80);
    if(/^\\/title(\\?|$)/.test(h)) send('blog_title_click',{page:page,target:h.slice(0,80)});
    else if(/^\\/(\\?|$)/.test(h)) send('blog_finder_click',{page:page});
    else if(/^\\/blog\\/[a-z0-9-]+/.test(h)) send('blog_guide_click',{page:page,target:h.slice(6,86)});
  });
})();
</script>
"""
def main(folder):
    n = 0
    for p in sorted(pathlib.Path(folder).glob("*.html")):
        s = p.read_text(encoding="utf-8")
        if MARK in s or "</article>" not in s: continue
        p.write_text(s.replace("</article>", JS + "</article>", 1), encoding="utf-8"); n += 1
    print("updated", n)
if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/blog")
