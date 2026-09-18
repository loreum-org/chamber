"""Generate a 1200x630 og.png social preview card for loreum.org.

Style mirrors the landing page: space-900 background (#0b0d17), soft accent
glow, LOREUM wordmark + headline. Run from the landing/ directory.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
BG = (11, 13, 23)        # --color-space-900
ACCENT = (208, 214, 249) # --color-space-accent (periwinkle)
GRAY = (156, 163, 175)

img = Image.new("RGB", (W, H), BG)

# Soft accent glows (top-right blue, bottom-left purple) like the hero orbs.
glow = Image.new("RGB", (W, H), BG)
gd = ImageDraw.Draw(glow)
gd.ellipse([850, -250, 1450, 350], fill=(30, 58, 138))
gd.ellipse([-250, 380, 350, 980], fill=(88, 28, 135))
glow = glow.filter(ImageFilter.GaussianBlur(180))
img = Image.blend(img, glow, 0.55)

draw = ImageDraw.Draw(img)

# Thin border frame
draw.rectangle([24, 24, W - 24, H - 24], outline=(255, 255, 255, 40), width=2)

def font(size, bold=False):
    idx = 1 if bold else 0
    return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size, index=idx)

# Eyebrow badge
badge_text = "CHAMBER · ONCHAIN GOVERNANCE"
bf = font(26)
bw = draw.textlength(badge_text, font=bf)
bx, by = 96, 118
draw.rounded_rectangle([bx, by, bx + bw + 56, by + 56], radius=28,
                       outline=ACCENT, width=2)
draw.text((bx + 28, by + 13), badge_text, font=bf, fill=ACCENT)

# Headline — three balanced lines, measured to stay inside the frame
hf = font(78, bold=True)
draw.text((96, 208), "DECENTRALIZED", font=hf, fill=(255, 255, 255))
draw.text((96, 300), "GOVERNANCE", font=hf, fill=(255, 255, 255))
draw.text((96, 392), "SYSTEM", font=hf, fill=(255, 255, 255))

# Subline
sub = "Factory-deployed ERC-4626 vault · ranked board · quorum wallet"
draw.text((96, 470), sub, font=font(34), fill=GRAY)

# Wordmark bottom-left + domain bottom-right
draw.text((96, 540), "LOREUM", font=font(40, bold=True), fill=(255, 255, 255))
draw.text((W - 96 - draw.textlength("loreum.org", font=font(34)), 548),
          "loreum.org", font=font(34), fill=ACCENT)

img.save("public/og.png", optimize=True)
print("wrote public/og.png", img.size)
