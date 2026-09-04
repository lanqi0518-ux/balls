# -*- coding: utf-8 -*-
"""
BALLS Lottery - Simple Promo Video Generator
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math
import random

# Video settings
WIDTH = 1080
HEIGHT = 1080
FPS = 24
DURATION = 6

# Colors
BG_COLOR = (10, 10, 10)
GREEN = (0, 200, 5)
GOLD = (255, 215, 0)
WHITE = (255, 255, 255)

OUTPUT_DIR = r"C:\Users\lanqi\powerball-lottery\video_frames"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_font(size):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def draw_ball(draw, x, y, r, num, color=GREEN, glow=False):
    if glow:
        for i in range(15, 0, -3):
            draw.ellipse([x-r-i, y-r-i, x+r+i, y+r+i], outline=color, width=2)
    
    draw.ellipse([x-r, y-r, x+r, y+r], fill=color)
    
    # Highlight
    hr = int(r * 0.25)
    draw.ellipse([x-r//2, y-r//2, x-r//2+hr, y-r//2+hr], 
                fill=(min(255, color[0]+80), min(255, color[1]+80), min(255, color[2]+80)))
    
    # Number
    font = get_font(int(r * 0.7))
    text = str(num)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x - tw//2, y - th//2 - 3), text, fill=WHITE, font=font)

def create_frame(frame_num, total_frames):
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    progress = frame_num / total_frames
    
    # Grid background
    for i in range(0, WIDTH, 40):
        draw.line([(i, 0), (i, HEIGHT)], fill=(0, 40, 0), width=1)
        draw.line([(0, i), (WIDTH, i)], fill=(0, 40, 0), width=1)
    
    # Sparkles
    random.seed(frame_num // 2)
    for _ in range(20):
        sx = random.randint(0, WIDTH)
        sy = random.randint(0, HEIGHT)
        ss = random.randint(1, 4)
        draw.ellipse([sx-ss, sy-ss, sx+ss, sy+ss], fill=(random.randint(100,255), random.randint(100,255), 50))
    
    # Phase 1: Title (0-1.5s)
    if progress < 0.25:
        p = progress / 0.25
        font = get_font(90)
        subfont = get_font(28)
        
        c = int(200 * p)
        draw.text((WIDTH//2 - 160, HEIGHT//2 - 80), "BALLS", fill=(0, c, 0), font=font)
        draw.text((WIDTH//2 - 200, HEIGHT//2 + 40), "Auto-Lottery on Robinhood", fill=(80, 80, 80), font=subfont)
    
    # Phase 2: Spinning balls (1.5-4s)
    elif progress < 0.67:
        p = (progress - 0.25) / 0.42
        
        cy = HEIGHT // 2
        r = 55
        sp = 140
        sx = WIDTH // 2 - sp * 2
        
        final_nums = [7, 21, 33, 42, 50]
        
        for i in range(5):
            bx = sx + i * sp
            by = cy + int(math.sin(frame_num * 0.4 + i) * 15)
            
            if p < 0.7:
                num = random.randint(1, 50)
            else:
                num = final_nums[i]
            
            draw_ball(draw, bx, by, r, num, glow=(p > 0.5))
        
        # Drawing text
        font = get_font(36)
        dots = "." * (frame_num // 4 % 4)
        draw.text((WIDTH//2 - 80, HEIGHT - 140), f"Drawing{dots}", fill=GOLD, font=font)
    
    # Phase 3: Winner (4-5s)
    elif progress < 0.83:
        cy = HEIGHT // 2
        r = 65
        sp = 150
        sx = WIDTH // 2 - sp * 2
        
        nums = [7, 21, 33, 42, 50]
        win_idx = 2  # 33 wins
        
        for i in range(5):
            bx = sx + i * sp
            by = cy
            
            if i == win_idx:
                pulse = 1 + math.sin(frame_num * 0.6) * 0.08
                draw_ball(draw, bx, by, int(r * pulse), nums[i], color=GOLD, glow=True)
            else:
                draw_ball(draw, bx, by, r, nums[i], glow=True)
        
        # Winner text
        font = get_font(55)
        if (frame_num // 3) % 2 == 0:
            draw.text((WIDTH//2 - 90, HEIGHT - 160), "WINNER!", fill=GOLD, font=font)
    
    # Phase 4: CTA (5-6s)
    else:
        tfont = get_font(48)
        sfont = get_font(32)
        xfont = get_font(26)
        
        draw.text((WIDTH//2 - 260, HEIGHT//2 - 100), "Win ETH Every Minute", fill=GREEN, font=tfont)
        draw.text((WIDTH//2 - 180, HEIGHT//2 - 30), "Hold BALLS. Get Paid.", fill=WHITE, font=sfont)
        
        draw.text((WIDTH//2 - 130, HEIGHT//2 + 50), "Top 200 Holders", fill=(120, 120, 120), font=xfont)
        draw.text((WIDTH//2 - 130, HEIGHT//2 + 85), "3% Tax = Prize Pool", fill=(120, 120, 120), font=xfont)
        draw.text((WIDTH//2 - 130, HEIGHT//2 + 120), "Auto ETH Payouts", fill=(120, 120, 120), font=xfont)
        
        draw.text((WIDTH//2 - 110, HEIGHT - 110), "@ballsonrobin", fill=GREEN, font=sfont)
    
    return img

def main():
    total_frames = FPS * DURATION
    print(f"Creating {total_frames} frames...")
    
    frames_list = []
    for i in range(total_frames):
        if i % 20 == 0:
            print(f"  Frame {i}/{total_frames}")
        
        frame = create_frame(i, total_frames)
        path = os.path.join(OUTPUT_DIR, f"frame_{i:04d}.png")
        frame.save(path)
        frames_list.append(path)
    
    print("Frames created!")
    
    # Try to make video
    output = r"C:\Users\lanqi\powerball-lottery\balls_promo.mp4"
    
    try:
        from moviepy.editor import ImageSequenceClip
        print("Creating MP4...")
        clip = ImageSequenceClip(frames_list, fps=FPS)
        clip.write_videofile(output, codec='libx264', fps=FPS, logger=None)
        print(f"Video saved: {output}")
    except Exception as e:
        print(f"MoviePy error: {e}")
        print("Trying ffmpeg...")
        import subprocess
        cmd = f'ffmpeg -y -framerate {FPS} -i "{OUTPUT_DIR}\\frame_%04d.png" -c:v libx264 -pix_fmt yuv420p "{output}"'
        result = subprocess.run(cmd, shell=True, capture_output=True)
        if result.returncode == 0:
            print(f"Video saved: {output}")
        else:
            print("FFmpeg failed. Frames are ready for manual video creation.")
            print(f"Frames: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
