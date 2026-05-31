import os
import csv
import random
import time

NUM_RECORDS = 10000
NUM_PLAYERS = 50
NUM_SKILLS = 10
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "training_data.csv")

AGGRESSIVE = "aggressive"
CONSERVATIVE = "conservative"
BALANCED = "balanced"
PLAY_STYLES = [AGGRESSIVE, CONSERVATIVE, BALANCED]

SKILL_WEIGHTS = {
    AGGRESSIVE: [0.05, 0.15, 0.15, 0.15, 0.12, 0.10, 0.08, 0.08, 0.06, 0.06],
    CONSERVATIVE: [0.15, 0.12, 0.10, 0.08, 0.08, 0.10, 0.10, 0.09, 0.09, 0.09],
    BALANCED: [0.10] * 10,
}


def generate_position(style):
    if style == AGGRESSIVE:
        x = random.uniform(-50, 50)
        y = random.uniform(-50, 50)
    elif style == CONSERVATIVE:
        x = random.uniform(-200, 200)
        y = random.uniform(-200, 200)
    else:
        x = random.uniform(-120, 120)
        y = random.uniform(-120, 120)
    return round(x, 2), round(y, 2)


def generate_target_dist(style):
    if style == AGGRESSIVE:
        return round(random.uniform(0.5, 5.0), 2)
    elif style == CONSERVATIVE:
        return round(random.uniform(8.0, 30.0), 2)
    else:
        return round(random.uniform(3.0, 15.0), 2)


def generate_cooldown(style):
    if style == AGGRESSIVE:
        return round(random.uniform(0.0, 0.3), 4)
    elif style == CONSERVATIVE:
        return round(random.uniform(0.3, 0.9), 4)
    else:
        return round(random.uniform(0.1, 0.6), 4)


def generate_hp(style):
    if style == AGGRESSIVE:
        return round(random.uniform(0.2, 0.7), 4)
    elif style == CONSERVATIVE:
        return round(random.uniform(0.6, 1.0), 4)
    else:
        return round(random.uniform(0.3, 0.9), 4)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    player_styles = {}
    for pid in range(1, NUM_PLAYERS + 1):
        player_styles[pid] = random.choice(PLAY_STYLES)

    rows = []
    base_ts = int(time.time()) - NUM_RECORDS * 2

    for i in range(NUM_RECORDS):
        pid = random.randint(1, NUM_PLAYERS)
        style = player_styles[pid]
        weights = SKILL_WEIGHTS[style]
        skill_id = random.choices(range(1, NUM_SKILLS + 1), weights=weights, k=1)[0]
        pos_x, pos_y = generate_position(style)
        target_dist = generate_target_dist(style)
        cooldown_ratio = generate_cooldown(style)
        hp_pct = generate_hp(style)
        timestamp = base_ts + i * 2 + random.randint(0, 1)
        rows.append([pid, timestamp, skill_id, pos_x, pos_y, target_dist, cooldown_ratio, hp_pct])

    rows.sort(key=lambda r: r[1])

    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["player_id", "timestamp", "skill_id", "pos_x", "pos_y",
                         "target_dist", "cooldown_ratio", "hp_pct"])
        writer.writerows(rows)

    print(f"Generated {NUM_RECORDS} records -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
