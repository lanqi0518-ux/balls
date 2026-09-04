# Generate frames in batches
import subprocess
import sys

TOTAL = 144  # 6 seconds at 24 fps
BATCH = 12

for start in range(0, TOTAL, BATCH):
    end = min(start + BATCH, TOTAL)
    print(f"Batch {start}-{end}...")
    
    code = f'''
import gc
from PIL import Image, ImageDraw, ImageFont
import os
import math
import random

WIDTH, HEIGHT = 1080, 1080
TOTAL = 144
OUT = r"C:\\Users\\lanqi\\powerball-lottery\\video_frames"
os.makedirs(OUT, exist_ok=True)

GREEN = (0, 200, 5)
GOLD = (255, 215, 0)
WHITE = (255, 255, 255)
BG = (10, 10, 10)

def get_font(size):
    return ImageFont.truetype("arial.ttf", size)

def draw_ball(d, x, y, r, num, color=GREEN, glow=False):
    if glow:
        for i in [6, 3]:
            d.ellipse([x-r-i, y-r-i, x+r+i, y+r+i], outline=color, width=1)
    d.ellipse([x-r, y-r, x+r, y+r], fill=color)
    f = get_font(int(r * 0.6))
    t = str(num)
    bb = d.textbbox((0, 0), t, font=f)
    d.text((x - (bb[2]-bb[0])//2, y - (bb[3]-bb[1])//2 - 2), t, fill=WHITE, font=f)

for fr in range({start}, {end}):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    
    for i in range(0, WIDTH+1, 50):
        d.line([(i, 0), (i, HEIGHT)], fill=(0, 30, 0))
        d.line([(0, i), (WIDTH, i)], fill=(0, 30, 0))
    
    random.seed(fr // 4)
    for _ in range(8):
        sx, sy = random.randint(0, WIDTH), random.randint(0, HEIGHT)
        d.ellipse([sx-2, sy-2, sx+2, sy+2], fill=(200, 200, 50))
    
    p = fr / TOTAL
    
    if p < 0.25:
        a = p / 0.25
        f1, f2 = get_font(80), get_font(24)
        d.text((WIDTH//2 - 140, HEIGHT//2 - 60), "BALLS", fill=(0, int(200*a), 0), font=f1)
        d.text((WIDTH//2 - 175, HEIGHT//2 + 30), "Auto-Lottery on Robinhood", fill=(70,70,70), font=f2)
    elif p < 0.65:
        a = (p - 0.25) / 0.4
        nums = [7, 21, 33, 42, 50]
        random.seed(fr)
        for i in range(5):
            bx = WIDTH//2 - 260 + i * 130
            by = HEIGHT//2 + int(math.sin(fr * 0.3 + i) * 10)
            n = nums[i] if a > 0.8 else random.randint(1, 50)
            draw_ball(d, bx, by, 48, n, glow=(a > 0.6))
        f = get_font(32)
        d.text((WIDTH//2 - 65, HEIGHT - 120), "Drawing" + "." * ((fr//6)%4), fill=GOLD, font=f)
    elif p < 0.83:
        nums = [7, 21, 33, 42, 50]
        for i in range(5):
            bx = WIDTH//2 - 260 + i * 130
            if i == 2:
                draw_ball(d, bx, HEIGHT//2, 55, nums[i], color=GOLD, glow=True)
            else:
                draw_ball(d, bx, HEIGHT//2, 55, nums[i], glow=True)
        if (fr//5)%2 == 0:
            d.text((WIDTH//2 - 75, HEIGHT - 140), "WINNER!", fill=GOLD, font=get_font(48))
    else:
        f1, f2, f3 = get_font(42), get_font(28), get_font(22)
        d.text((WIDTH//2 - 225, HEIGHT//2 - 80), "Win ETH Every Minute", fill=GREEN, font=f1)
        d.text((WIDTH//2 - 155, HEIGHT//2 - 20), "Hold BALLS. Get Paid.", fill=WHITE, font=f2)
        d.text((WIDTH//2 - 105, HEIGHT//2 + 40), "Top 200 Holders", fill=(100,100,100), font=f3)
        d.text((WIDTH//2 - 105, HEIGHT//2 + 68), "3% Tax = Prize Pool", fill=(100,100,100), font=f3)
        d.text((WIDTH//2 - 105, HEIGHT//2 + 96), "Auto ETH Payouts", fill=(100,100,100), font=f3)
        d.text((WIDTH//2 - 90, HEIGHT - 95), "@ballsonrobin", fill=GREEN, font=f2)
    
    img.save(os.path.join(OUT, f"f_{{fr:04d}}.png"))
    del img
    gc.collect()

print("Batch done")
'''
    
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"  Error: {result.stderr[:200]}")
    else:
        print(f"  OK")

print("All frames done!")
