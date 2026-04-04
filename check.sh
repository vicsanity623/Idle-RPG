#!/bin/bash

echo "🚀 Running Idle Pets RPG Validation on GitHub Actions..."

# 1. Install dependencies
echo "📦 Installing testing dependencies..."
python3 -m pip install --upgrade pip --quiet
python3 -m pip install pytest selenium --quiet

# 2. Automatically generate the test file
echo "🔧 Setting up headless testing environment..."
mkdir -p tests
cat << 'EOF' > tests/test_main.py
import os
import time
import json
import unittest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

class TestIdlePetsRPG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        cls.root_dir = os.path.dirname(current_dir)
        cls.index_path = os.path.join(cls.root_dir, 'index.html')

        # Fallback if running directly in the same directory
        if not os.path.exists(cls.index_path):
            cls.index_path = os.path.join(current_dir, 'index.html')
            
        if not os.path.exists(cls.index_path):
            raise FileNotFoundError(f"Could not find index.html at {cls.index_path}. Make sure the standalone HTML file is named index.html")

        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        cls.driver = webdriver.Chrome(options=chrome_options)
        file_uri = f"file://{cls.index_path}"
        cls.driver.get(file_uri)
        
        # Clear storage and reload to ensure a fresh state for testing
        cls.driver.execute_script("localStorage.clear();")
        cls.driver.refresh()
        time.sleep(1) # Wait for DOM and game to initialize

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def test_01_initialization(self):
        # Test if the game sets up default values correctly
        food = self.driver.execute_script("return rpgGame.state.food;")
        level = self.driver.execute_script("return rpgGame.state.pets[0].level;")
        
        self.assertEqual(food, 10, "Game should initialize with 10 Food")
        self.assertEqual(level, 1, "Initial pet should start at Level 1")

    def test_02_feeding_mechanic(self):
        # Manually lower hunger to test feeding
        self.driver.execute_script("rpgGame.state.pets[0].hunger = 50; rpgGame.updateUI();")
        
        # Feed the pet
        self.driver.execute_script("rpgGame.feedPet();")
        
        food = self.driver.execute_script("return rpgGame.state.food;")
        hunger = self.driver.execute_script("return rpgGame.state.pets[0].hunger;")
        
        self.assertEqual(food, 9, "Food should decrease by 1 after feeding")
        self.assertEqual(hunger, 80, "Hunger should increase by 30 (from 50 to 80)")

    def test_03_level_up_mechanic(self):
        # Max out XP artificially
        self.driver.execute_script("""
            let pet = rpgGame.state.pets[0];
            pet.xp = pet.maxXp;
            rpgGame.updateUI();
        """)
        
        # Trigger level up
        self.driver.execute_script("rpgGame.levelUpPet();")
        
        level = self.driver.execute_script("return rpgGame.state.pets[0].level;")
        xp = self.driver.execute_script("return rpgGame.state.pets[0].xp;")
        
        self.assertEqual(level, 2, "Pet should advance to Level 2")
        self.assertEqual(xp, 0, "XP should reset to 0 after leveling up")

    def test_04_save_load_system(self):
        # Inject a fake save into localStorage
        fake_save = {
            "pets": [{"id": 999, "typeIndex": 2, "emoji": "🐥", "name": "Baby Bird", "level": 10, "xp": 0, "maxXp": 500, "hp": 200, "maxHp": 200, "hunger": 100, "maxHunger": 100}],
            "activePetIndex": 0,
            "food": 99,
            "gems": 50,
            "lastTick": int(time.time() * 1000),
            "lastDaily": int(time.time() * 1000) # prevent daily login override during test
        }
        
        save_json = json.dumps(fake_save)
        self.driver.execute_script(f"localStorage.setItem('idle_rpg_save_standalone_v1', JSON.stringify({save_json}));")
        
        # Re-initialize the game instance to trigger loadState()
        self.driver.execute_script("rpgGame = new IdleRPG();")
        
        loaded_food = self.driver.execute_script("return rpgGame.state.food;")
        loaded_level = self.driver.execute_script("return rpgGame.state.pets[0].level;")
        loaded_name = self.driver.execute_script("return rpgGame.state.pets[0].name;")
        
        self.assertEqual(loaded_food, 99, "Game should load the saved 99 Food")
        self.assertEqual(loaded_level, 10, "Game should load the saved Pet Level 10")
        self.assertEqual(loaded_name, "Baby Bird", "Game should load the evolved pet name")

if __name__ == "__main__":
    unittest.main()
EOF

# 3. Run the test suite and capture the exit code
echo "🧪 Running E2E tests for Idle Pets RPG..."
python3 -m pytest tests/test_main.py -v
TEST_EXIT_CODE=$?

# 4. Evaluate the result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All checks passed! The Idle Pets RPG functions and save states work perfectly."
    exit 0
else
    echo "❌ Tests failed! Please review the logs above."
    exit 1
fi
