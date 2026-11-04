import sys, glob
from PIL import Image
files = sorted(glob.glob(sys.argv[1]))
cols = int(sys.argv[3]) if len(sys.argv)>3 else 5
w, h = 360, 640
rows = (len(files)+cols-1)//cols
S = Image.new('RGB', (cols*w, rows*h), (40,40,40))
for i,f in enumerate(files):
    im = Image.open(f).resize((w,h), Image.LANCZOS)
    S.paste(im, ((i%cols)*w, (i//cols)*h))
S.save(sys.argv[2], quality=88)
