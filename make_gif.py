# -*- coding: utf-8 -*-
# Simple GIF generator for Twitter
from PIL import Image, ImageDraw, ImageFont
import math
import random

WIDTH, HEIGHT = 600, 600  # Smaller for GIF
FRAMES = 60  # 60 frames at ~15fps = 4 seconds

GREEN = (0, 200, 5)
GOLD = (255, 215, 0)
WHITE = (255, 255, 255)
BG = (15, 15, 15)

def get_font(size):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

images = []

print("Creating GIF frames...")
for fr in range(FRAMES):
    if fr % 15 == 0:
        print(f"  Frame {fr}/{FRAMES}")
    
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    
    # Grid
    for i in range(0, WIDTH + 1, 30):
        d.line([(i, 0), (i, HEIGHT)], fill=(0, 35, 0))
        d.line([(0, i), (WIDTH, i)], fill=(0, 35, 0))
    
    p = fr / FRAMES
    
    # Phase 1: Title (0-25%)
    if p < 0.25:
        a = p / 0.25
        f1 = get_font(60)
        f2 = get_font(18)
        cv = int(200 * a)
        d.text((WIDTH//2 - 95, HEIGHT//2 - 45), "BALLS", fill=(0, cv, 0), font=f1)
        d.text((WIDTH//2 - 120, HEIGHT//2 + 25), "Auto-Lottery on Robinhood", fill=(70, 70, 70), font=f2)
    
    # Phase 2: Spinning balls (25-65%)
    elif p < 0.65:
        a = (p - 0.25) / 0.4
        nums = [7, 21, 33, 42, 50]
        cy = HEIGHT // 2
        random.seed(fr)
        
        for i in range(5):
            bx = WIDTH//2 - 170 + i * 85
            by = cy + int(math.sin(fr * 0.4 + i) * 8)
            r = 32
            
            n = nums[i] if a > 0.8 else random.randint(1, 50)
            
            # Ball
            if a > 0.6:
                d.ellipse([bx-r-4, by-r-4, bx+r+4, by+r+4], outline=GREEN, width=1)
            d.ellipse([bx-r, by-r, bx+r, by+r], fill=GREEN)
            
            # Number
            f = get_font(22)
            t = str(n)
            bb = d.textbbox((0, 0), t, font=f)
            d.text((bx - (bb[2]-bb[0])//2, by - (bb[3]-bb[1])//2 - 2), t, fill=WHITE, font=f)
        
        # Drawing text
        f = get_font(24)
        dots = "." * ((fr // 4) % 4)
        d.text((WIDTH//2 - 50, HEIGHT - 80), f"Drawing{dots}", fill=GOLD, font=f)
    
    # Phase 3: Winner (65-85%)
    elif p < 0.85:
        nums = [7, 21, 33, 42, 50]
        cy = HEIGHT // 2
        
        for i in range(5):
            bx = WIDTH//2 - 170 + i * 85
            r = 36 if i == 2 else 32
            color = GOLD if i == 2 else GREEN
            
            d.ellipse([bx-r-4, by-r-4, bx+r+4, by+r+4], outline=color, width=1)
            d.ellipse([bx-r, cy-r, bx+r, cy+r], fill=color)
            
            f = get_font(24)
            t = str(nums[i])
            bb = d.textbbox((0, 0), t, font=f)
            d.text((bx - (bb[2]-bb[0])//2, cy - (bb[3]-bb[1])//2 - 2), t, fill=WHITE, font=f)
        
        # Winner text
        if (fr // 3) % 2 == 0:
            f = get_font(36)
            d.text((WIDTH//2 - 60, HEIGHT - 90), "WINNER!", fill=GOLD, font=f)
    
    # Phase 4: CTA (85-100%)
    else:
        f1 = get_font(30)
        f2 = get_font(22)
        f3 = get_font(16)
        
        d.text((WIDTH//2 - 155, HEIGHT//2 - 70), "Win ETH Every Minute", fill=GREEN, font=f1)
        d.text((WIDTH//2 - 110, HEIGHT//2 - 25), "Hold BALLS. Get Paid.", fill=WHITE, font=f2)
        
        d.text((WIDTH//2 - 75, HEIGHT//2 + 20), "Top 200 Holders", fill=(100,100,100), font=f3)
        d.text((WIDTH//2 - 75, HEIGHT//2 + 42), "3% Tax = Prize Pool", fill=(100,100,100), font=f3)
        d.text((WIDTH//2 - 75, HEIGHT//2 + 64), "Auto ETH Payouts", fill=(100,100,100), font=f3)
        
        d.text((WIDTH//2 - 70, HEIGHT - 70), "@ballsonrobin", fill=GREEN, font=f2)
    
    images.append(img)

print("Saving GIF...")
output = r"C:\Users\lanqi\powerball-lottery\balls_promo.gif"
images[0].save(
    output,
    save_all=True,
    append_images=images[1:],
    duration=67,  # ~15 fps
    loop=0
)

print(f"Done! GIF saved: {output}")
print("File size:", round(__import__('os').path.getsize(output) / 1024 / 1024, 2), "MB")
