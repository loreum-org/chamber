# Loreum Tapestry panels

Source for the Bayeux-style alien panels in `public/art/`.

```bash
cd landing/scripts/tapestry
npm i --no-save @fontsource/uncial-antiqua playwright
node gen.js      # writes svg/*.html
mkdir -p out && node render.js   # writes out/*.png at 1000×500
for f in out/*.png; do convert "$f" -strip -quality 80 ../../public/art/$(basename "$f" .png).jpg; done
```
