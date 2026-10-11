#!/usr/bin/env python3
"""Adds the Friday-pick email signup block to every blog article.

Usage (from your project folder):   python3 add_signup_block.py public/blog
Safe to re-run: files that already contain the block are skipped.
"""
import sys, pathlib

MARK = "<!--wwk-signup-->"

CSS = """
/* wwk-signup */
.signup-block{background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.35);border-radius:16px;padding:28px 30px;margin:40px 0 8px;text-align:center}
.signup-block h2{font-family:'Playfair Display',serif;font-size:24px;color:#fff;margin:0 0 8px;line-height:1.2}
.signup-block p{font-size:15px;color:#c8c8de;margin:0 0 16px}
.signup-form{display:flex;gap:8px;max-width:420px;margin:0 auto}
.signup-form input{flex:1;min-width:0;background:#0a0a14;border:1px solid #2a2a3a;border-radius:100px;padding:12px 18px;color:#fff;font:inherit;font-size:15px}
.signup-form input:focus{outline:none;border-color:#f59e0b}
.signup-form button{background:linear-gradient(135deg,#f59e0b,#f0860a);color:#0a0a14;border:0;border-radius:100px;padding:12px 22px;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.signup-note{font-family:'DM Mono',monospace;font-size:11px;color:#84849c;margin-top:12px!important;margin-bottom:0!important;letter-spacing:.06em}
.signup-ok{display:none;color:#4ade80;font-weight:600}
@media(max-width:480px){.signup-form{flex-direction:column}.signup-block{padding:24px 18px}}
"""

HTML = """<!--wwk-signup-->
<div class="signup-block" id="wwk-signup">
  <h2>One great family pick, every Friday</h2>
  <p>A hand-picked movie or show for your kids' ages, in your inbox. No scrolling required.</p>
  <form class="signup-form" id="wwk-signup-form" action="https://formspree.io/f/xgordpww" method="POST">
    <input type="email" name="email" placeholder="your@email.com" required autocomplete="email" aria-label="Email address"/>
    <button type="submit">Subscribe</button>
  </form>
  <p class="signup-ok" id="wwk-signup-ok">✓ You're in! First pick lands this Friday.</p>
  <p class="signup-note">No spam · Unsubscribe anytime · Free</p>
</div>
<script>
(function(){
  var f=document.getElementById('wwk-signup-form'); if(!f) return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var b=f.querySelector('button'); b.disabled=true;
    fetch(f.action,{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}})
      .then(function(r){
        if(!r.ok) throw new Error('bad');
        try{ if(window.gtag) gtag('event','email_subscribed',{source:'blog'}); }catch(x){}
        f.style.display='none'; document.getElementById('wwk-signup-ok').style.display='block';
      })
      .catch(function(){ b.disabled=false; alert('Sorry, that did not go through. Please try again.'); });
  });
})();
</script>
"""

def main(folder):
    done = skipped = 0
    for p in sorted(pathlib.Path(folder).glob("*.html")):
        s = p.read_text(encoding="utf-8")
        if MARK in s:
            skipped += 1; continue
        if "</article>" not in s or "</style>" not in s:
            print("SKIP (unexpected layout):", p.name); continue
        s = s.replace("</style>", CSS + "</style>", 1)
        s = s.replace("</article>", HTML + "</article>", 1)
        p.write_text(s, encoding="utf-8"); done += 1
    print(f"updated {done}, already had it {skipped}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/blog")
