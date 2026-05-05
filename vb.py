import numpy as np
import pickle
import os
import pygame
import time
import random
import psutil

# ==========================================
# 1. THE BRAIN (CTRNN) - With Stability Governors
# ==========================================
BRAIN_SIZE = 100
MEMORY_SIZE = 32        # Compressed memory vector (token-wise compression)
ATTENTION_WINDOW = 16   # OPT2: Reduced from 50 → 16 for 3x attention speedup
PLANNING_HORIZON = 5    # Steps to simulate ahead
BRAIN_TICK_EVERY = 3    # OPT3: Brains only re-think every N physics steps
MAX_PLANNERS_PER_TICK = 5  # OPT4: Cap simultaneous forward-planners

class ImprovedCTRNN:
    def __init__(self, size=BRAIN_SIZE):
        self.size = size
        self.voltages = np.zeros(size)
        self.adaptation = np.zeros(size)
        self.time_constants = np.random.uniform(2.0, 10.0, size)
        self.biases = np.random.uniform(-1.0, 1.0, size)
        self.weights = np.random.uniform(-1.0, 1.0, (size, size))
        
        # NEW: Token-wise compression (projects sensory input to compact memory)
        self.compress_weights = np.random.uniform(-0.5, 0.5, (MEMORY_SIZE, 19))  # 19 sensors
        self.compressed_memory = np.zeros(MEMORY_SIZE)
        
        # NEW: Sparse attention over past voltage states
        self.voltage_history = []  # Stores recent voltage vectors
        self.attention_weights = np.random.uniform(-0.5, 0.5, (size, ATTENTION_WINDOW))
        
        # NEW: Dual-mode state (0 = fast/intuitive, 1 = slow/deliberate)
        self.thinking_mode = 0  # 0=Fast, 1=Slow
        self.mode_switch_threshold = 0.7  # Uncertainty triggers slow mode
        
        # NEW: Long-term memory traces (slow variables for 1M-like context)
        self.ltm_trace = np.zeros(size)      # Very slow-moving average
        self.ltm_decay = 0.999               # Almost permanent
        
        # Planning buffer (for agentic simulation)
        self.plan_buffer = []  # Stores (action, predicted_outcome)
        
        # OPT3: Cached outputs for throttled ticking
        self._last_outputs = np.full(size, 0.5)  # Default to mid-range outputs
        
    def compress_sensors(self, sensors):
        """Token-wise compression: project 19 dims -> MEMORY_SIZE dims"""
        if sensors is None:
            sensors = np.zeros(19)
        compressed = np.tanh(np.dot(self.compress_weights, sensors))
        # Rolling update of compressed memory (like a running average)
        self.compressed_memory = 0.9 * self.compressed_memory + 0.1 * compressed
        return self.compressed_memory
    
    def sparse_attention(self, current_voltages):
        """DSA-inspired: attend to relevant past states"""
        if len(self.voltage_history) < 2:
            return current_voltages
        
        # Take last ATTENTION_WINDOW states (or pad with zeros)
        history = self.voltage_history[-ATTENTION_WINDOW:]
        if len(history) < ATTENTION_WINDOW:
            history = [np.zeros(self.size)] * (ATTENTION_WINDOW - len(history)) + history
        
        history_matrix = np.array(history).T  # shape: (size, window)
        
        # Compute attention scores (dot product similarity)
        # We element-wise multiply the attention weights with the history matrix
        # Or if attention_weights is (size, window), we just element-wise multiply them to get the scores.
        # Actually, let's just use element-wise multiplication for the scores since both are (size, window)
        scores = self.attention_weights * history_matrix  # (size, window)
        scores = np.clip(scores, -10, 10)
        
        # FAST Sparse: Use mean instead of percentile for 10x faster execution
        threshold = np.mean(np.abs(scores), axis=1, keepdims=True) * 1.5
        scores[np.abs(scores) < threshold] = -20  # -20 acts as -infinity for softmax
        
        # Apply softmax per neuron
        exp_scores = np.exp(scores - np.max(scores, axis=1, keepdims=True))
        attention = exp_scores / (np.sum(exp_scores, axis=1, keepdims=True) + 1e-8)
        
        # Attend: weighted sum of history
        attended = np.sum(history_matrix * attention, axis=1)
        return attended
    
    def get_outputs(self, uncertainty=None):
        """Dual-mode: fast (direct) or slow (deliberate with attention)"""
        active_voltages = np.clip(self.voltages - (self.adaptation * 1.5), -50, 50)
        
        # Determine thinking mode based on uncertainty or environment novelty
        if uncertainty is not None:
            self.thinking_mode = 1 if uncertainty > self.mode_switch_threshold else 0
        
        if self.thinking_mode == 0:
            # Fast mode: direct sigmoid
            outputs = 1.0 / (1.0 + np.exp(-active_voltages))
        else:
            # Slow mode: apply sparse attention first
            attended = self.sparse_attention(active_voltages)
            outputs = 1.0 / (1.0 + np.exp(-attended))
        
        return outputs
    
    def forward_plan(self, env_copy_func, steps=PLANNING_HORIZON):
        """Agentic capability: simulate future before acting"""
        plans = []
        current_state = self.voltages.copy()
        
        # FAST Planning: Temporarily force fast thinking mode to save CPU
        original_mode = self.thinking_mode
        self.thinking_mode = 0 
        
        for action_variation in np.linspace(-0.5, 0.5, 3):  # Try 3 different motor biases
            sim_voltages = current_state.copy()
            total_reward = 0
            
            for step in range(steps):
                # Temporarily swap voltages to simulate
                self.voltages = sim_voltages
                outputs = self.get_outputs()
                motor = outputs[-2:] + action_variation
                
                # Use a simplified world model (you would replace with actual env dynamics)
                total_reward += np.random.randn() * 0.1  # Placeholder
                
                # Update simulated voltages
                sim_derivative = (-sim_voltages + self.biases) / self.time_constants
                sim_voltages = sim_voltages + sim_derivative * 0.1
                
                # Restore voltages
                self.voltages = current_state
            
            plans.append((action_variation, total_reward))
            
        self.thinking_mode = original_mode
        
        # Choose best action bias
        best_action = max(plans, key=lambda x: x[1])[0]
        return best_action
    
    def tick(self, dt, sensors, uncertainty=None, use_planning=False, precomputed_net_input=None):
        """Enhanced tick with all DeepSeek V4 features"""
        # 1. Compress sensors into working memory
        compressed = self.compress_sensors(sensors)
        
        # 2. CTRNN dynamics — use precomputed batch matmul if available (OPT5)
        outputs = self.get_outputs(uncertainty)
        if precomputed_net_input is not None:
            network_input = precomputed_net_input + self.biases
        else:
            network_input = np.dot(self.weights, outputs) + self.biases
        
        # Inject compressed memory into first MEMORY_SIZE neurons
        total_input = network_input.copy()
        inject_size = min(self.size, len(compressed))
        total_input[:inject_size] += compressed[:inject_size]
        
        if sensors is not None:
            sensor_inject_size = min(self.size, len(sensors))
            total_input[:sensor_inject_size] += sensors[:sensor_inject_size]
        
        derivative = (-self.voltages + total_input) / self.time_constants
        self.voltages = np.clip(self.voltages + derivative * dt, -100, 100)
        
        # 3. Update adaptation and long-term memory trace
        self.adaptation += (outputs * 0.1 - self.adaptation * 0.05) * dt
        self.ltm_trace = self.ltm_trace * self.ltm_decay + outputs * (1 - self.ltm_decay)
        
        # 4. Store voltage history for attention mechanism
        self.voltage_history.append(self.voltages.copy())
        if len(self.voltage_history) > ATTENTION_WINDOW * 2:
            self.voltage_history = self.voltage_history[-ATTENTION_WINDOW:]
        
        # 5. Optional forward planning (OPT4: only if budget allows)
        if use_planning and np.random.rand() < 0.05 and _plan_budget[0] > 0:
            _plan_budget[0] -= 1
            action_bias = self.forward_plan(None)
            outputs[-2:] += action_bias
        
        # OPT3: Cache outputs for throttled ticks
        self._last_outputs = outputs
        return outputs

# ==========================================
# 2. THE WORLD ENVIRONMENT (SCALED TO 50x50)
# ==========================================
class Environment:
    def __init__(self, king_gen, max_health=150):
        self.gen = king_gen
        self.max_health = max_health
        self.agent_pos = np.array([25.0, 25.0]) # Scaled from 50
        self.num_food = 10
        self.food_positions = [np.random.uniform(7.5, 42.5, 2) for _ in range(self.num_food)] # Scaled from 15,85
        self.food_vels = [np.random.uniform(-0.2, 0.2, 2) if self.gen > 200 else np.zeros(2) for _ in range(self.num_food)] # Scaled from 0.4
        self.num_poison = 3
        self.poison_positions = [np.random.uniform(7.5, 42.5, 2) for _ in range(self.num_poison)] # Scaled from 15,85
        self.poison_vels = [np.random.uniform(-0.15, 0.15, 2) if self.gen > 200 else np.zeros(2) for _ in range(self.num_poison)] # Scaled from 0.3
        self.enemy_pos = np.array([2.5, 2.5]) # Scaled from 5.0
        
        self.health = float(max_health)
        self.food_count = 0
        self.ticks = 0
        self.wall_contact_count = 0
        self.food_visible = True
        self.predator_active = (self.gen >= 500)

    def get_sensors(self):
        self.food_visible = (self.ticks % 300) < 240
        
        # Fast normalization replacing np.linalg.norm, also returns distance for awareness radius
        def norm_vec_dist(target):
            dx, dy = target[0] - self.agent_pos[0], target[1] - self.agent_pos[1]
            dist = np.sqrt(dx*dx + dy*dy) + 0.001
            return [dx / dist, dy / dist], dist

        # Fast squared distance for target finding
        if self.food_visible:
            dists_sq = [(f[0]-self.agent_pos[0])**2 + (f[1]-self.agent_pos[1])**2 for f in self.food_positions]
            food_s, food_dist = norm_vec_dist(self.food_positions[np.argmin(dists_sq)])
        else: 
            food_s, food_dist = [0.0, 0.0], 50.0

        p_dists_sq = [(p[0]-self.agent_pos[0])**2 + (p[1]-self.agent_pos[1])**2 for p in self.poison_positions]
        pois_s, pois_dist = norm_vec_dist(self.poison_positions[np.argmin(p_dists_sq)])
        
        # Curiosity point (center of the world where items spawn)
        center_s, center_dist = norm_vec_dist([25.0, 25.0])
        
        # Normalize distances (awareness radius = world size 50)
        # Closer = closer to 1.0, further = closer to 0.0
        f_prox = max(0.0, 1.0 - (food_dist / 50.0))
        p_prox = max(0.0, 1.0 - (pois_dist / 50.0))
        c_prox = max(0.0, 1.0 - (center_dist / 50.0))
        
        # Wall sensors scaled down from (20/80) out of 100 to (10/40) out of 50
        w_l = (10.0 - self.agent_pos[0])/10.0 if self.agent_pos[0] < 10 else 0
        w_r = (self.agent_pos[0] - 40.0)/10.0 if self.agent_pos[0] > 40 else 0
        w_t = (10.0 - self.agent_pos[1])/10.0 if self.agent_pos[1] < 10 else 0
        w_b = (self.agent_pos[1] - 40.0)/10.0 if self.agent_pos[1] > 40 else 0
        
        # Pain boundaries scaled to 0.5 and 49.5
        pain = 1.0 if (self.agent_pos[0]<=0.5 or self.agent_pos[0]>=49.5 or self.agent_pos[1]<=0.5 or self.agent_pos[1]>=49.5) else 0.0
        hunger = (100.0 - self.health) / 100.0
        osc = np.sin(self.ticks * 0.2)
        
        if self.predator_active:
            enem_s, enem_dist = norm_vec_dist(self.enemy_pos)
            e_prox = max(0.0, 1.0 - (enem_dist / 50.0))
        else:
            enem_s, e_prox = [0.0, 0.0], 0.0

        # KEEP PREVIOUS 13 INPUTS IN SAME ORDER SO PICKLE DOES NOT BREAK
        # APPENDED 6 NEW SENSORS (f_prox, p_prox, center_s[0], center_s[1], c_prox, e_prox)
        return np.array([
            food_s[0], food_s[1], pois_s[0], pois_s[1], 
            w_l, w_r, w_t, w_b, 
            hunger, osc, enem_s[0], enem_s[1], pain,
            f_prox, p_prox, center_s[0], center_s[1], c_prox, e_prox
        ])

    def update(self, motor_output, brain=None):
        self.ticks += 1
        # Speeds scaled down to 1.4 from 2.8
        dx, dy = (motor_output[0]-0.5)*1.4, (motor_output[1]-0.5)*1.4
        new_pos = self.agent_pos + [dx, dy]
        
        # Boundaries scaled to 50
        hit_wall = (new_pos[0]<=0 or new_pos[0]>=50 or new_pos[1]<=0 or new_pos[1]>=50)
        if hit_wall: 
            self.wall_contact_count += 1
            # BOUNCE off the wall so they don't get stuck indefinitely
            new_pos[0] = np.clip(new_pos[0], 2.0, 48.0)
            new_pos[1] = np.clip(new_pos[1], 2.0, 48.0)
            
        self.agent_pos = np.clip(new_pos, 0, 50)
        
        if np.isnan(self.agent_pos).any(): self.agent_pos = np.array([25.0, 25.0])

        if self.predator_active:
            dir_e = self.agent_pos - self.enemy_pos
            dist = np.sqrt(dir_e[0]**2 + dir_e[1]**2) + 0.01
            self.enemy_pos += (dir_e / dist) * 0.325 # Scaled from 0.65
        
        # MASSIVE damage for hitting the wall (forces evolution to stay centered)
        self.health -= (1.5 if hit_wall else 0.008)
        ate_food = False
        
        # Fast squared collision logic - Distances scaled down (6.25 is 2.5 squared)
        for i in range(self.num_food):
            dist_sq = (self.agent_pos[0]-self.food_positions[i][0])**2 + (self.agent_pos[1]-self.food_positions[i][1])**2
            if dist_sq < 6.25:  
                self.health = min(100, self.health + 45); self.food_count += 1
                self.last_food_time = self.ticks
                self.food_positions[i] = np.random.uniform(7.5, 42.5, 2); ate_food = True
            
        for i in range(self.num_poison):
            self.poison_positions[i] += self.poison_vels[i]
            if self.poison_positions[i][0]<0 or self.poison_positions[i][0]>50: self.poison_vels[i][0]*=-1
            if self.poison_positions[i][1]<0 or self.poison_positions[i][1]>50: self.poison_vels[i][1]*=-1
            
            # Poison collision - Distances scaled down (4.0 is 2.0 squared)
            dist_sq = (self.agent_pos[0]-self.poison_positions[i][0])**2 + (self.agent_pos[1]-self.poison_positions[i][1])**2
            if dist_sq < 4.0:  
                self.health -= 70
                self.poison_positions[i] = np.random.uniform(7.5, 42.5, 2)

        pred_dist_sq = (self.agent_pos[0]-self.enemy_pos[0])**2 + (self.agent_pos[1]-self.enemy_pos[1])**2
        killed = (self.health <= 0 or (self.predator_active and pred_dist_sq < 4.0)) # 4.0 is 2.0 squared
        
        # OPT3: Only run brain.tick() every BRAIN_TICK_EVERY physics steps
        if brain is not None:
            if self.ticks % BRAIN_TICK_EVERY == 0:
                # High uncertainty when: low health, many walls hit, or long time without food
                uncertainty = 0.0
                uncertainty += max(0, (100 - self.health) / 100) * 0.4
                uncertainty += min(1.0, self.wall_contact_count / 50) * 0.3
                last_food = getattr(self, 'last_food_time', 0)
                uncertainty += 0.3 if (self.ticks - last_food) > 200 else 0.0
                
                # Pass to brain for dual-mode thinking (with batched net input from main loop)
                brain.tick(0.1, self.get_sensors(), uncertainty,
                           use_planning=(uncertainty > 0.6),
                           precomputed_net_input=getattr(brain, '_batched_net_in', None))
            # else: brain coasts on _last_outputs from previous tick
            
        return not killed, ate_food

# ==========================================
# 3. CONTROL ROOM (GUI)
# ==========================================
def deepseek_style_mutate(brain):
    """Mutation with sparse updates (inspired by sparse attention)"""
    nb = ImprovedCTRNN(brain.size)
    
    # Only mutate 20% of weights (sparse updates)
    mask = np.random.rand(*brain.weights.shape) < 0.2
    nb.weights = np.clip(
        brain.weights + np.random.normal(0, 0.3, brain.weights.shape) * mask,
        -10, 10
    )
    
    # Mutate compression weights less frequently
    if np.random.rand() < 0.1:
        nb.compress_weights = np.clip(
            brain.compress_weights + np.random.normal(0, 0.1, brain.compress_weights.shape),
            -1, 1
        )
    
    # Mutate attention weights (only if shapes match — guards against old pickles)
    if np.random.rand() < 0.15 and brain.attention_weights.shape == nb.attention_weights.shape:
        nb.attention_weights = np.clip(
            brain.attention_weights + np.random.normal(0, 0.2, brain.attention_weights.shape),
            -1, 1
        )
    
    nb.biases = np.clip(
        brain.biases + np.random.normal(0, 0.2, brain.biases.shape) * (np.random.rand(*brain.biases.shape) < 0.2),
        -5, 5
    )
    
    # Inherit long-term memory trace and compressed memory
    nb.ltm_trace = brain.ltm_trace.copy()
    nb.compressed_memory = brain.compressed_memory.copy()
    
    return nb

COLS, ROWS = 10, 10
NUM_AGENTS = COLS * ROWS
PANEL_W, PANEL_H = 120, 80
SAVE_FILE = "evolved_core_brain.pkl"

pygame.init()
screen = pygame.display.set_mode((600, 630), pygame.RESIZABLE)
font = pygame.font.SysFont("Verdana", 9, bold=True)
big_font = pygame.font.SysFont("Verdana", 18, bold=True)
tiny_font = pygame.font.SysFont("Verdana", 8)
clock = pygame.time.Clock()

if os.path.exists(SAVE_FILE):
    with open(SAVE_FILE, "rb") as f:
        data = pickle.load(f)
        k_brain = data['brain']; k_score = data.get('score', 0); k_gen = data.get('generation', 1); k_food = data.get('food', 0)
        k_max_health = data.get('max_health', 150)
        
        # Prevent crash if brain size OR attention window changed
        wrong_size = getattr(k_brain, 'size', 34) != BRAIN_SIZE
        wrong_attn = getattr(k_brain, 'attention_weights', np.zeros((1,1))).shape != (BRAIN_SIZE, ATTENTION_WINDOW)
        if wrong_size or wrong_attn:
            print(f"Brain architecture changed (size or attention window). Starting fresh evolution!")
            k_brain, k_score, k_gen, k_food, k_max_health = ImprovedCTRNN(BRAIN_SIZE), 0, 1, 0, 150
else:
    k_brain, k_score, k_gen, k_food, k_max_health = ImprovedCTRNN(BRAIN_SIZE), 0, 1, 0, 150

brains = [k_brain] + [deepseek_style_mutate(k_brain) for _ in range(NUM_AGENTS-1)]
envs = [Environment(k_gen, k_max_health) for _ in range(NUM_AGENTS)]
speed_multi = 1.0

# OPT4: Global planning budget — reset each tick, shared via mutable list
_plan_budget = [MAX_PLANNERS_PER_TICK]

# TOGGLE SWITCH VARIABLES
show_world = True   # Toggle world entity rendering (food, agent, poison) on/off
toggle_w, toggle_h = 160, 30
toggle_rect = pygame.Rect(300 - toggle_w // 2, 10, toggle_w, toggle_h)
last_sys_update = 0
sys_load_cache = (0, 0)

def fmt_score(n):
    """Format a number to at most 3 digits + suffix (K, M, B, T)."""
    for suffix, threshold in [('T', 1e12), ('B', 1e9), ('M', 1e6), ('K', 1e3)]:
        if abs(n) >= threshold:
            val = n / threshold
            return f"{val:.0f}{suffix}" if val >= 100 else f"{val:.1f}{suffix}"
    return str(int(n))

def get_shader_surface(w, h, t):
    """Numpy-based shader equivalent of the GLSL code provided."""
    # Scale down for performance
    sw, sh = max(1, w // 2), max(1, h // 2)
    X, Y = np.meshgrid(np.arange(sw), np.arange(sh))
    
    px = (X * 2.0 - sw) / sh
    py = (Y * 2.0 - sh) / sh
    
    dot_p = px*px + py*py
    l = np.abs(0.7 - dot_p)
    
    vx = px * (1.0 - l) / 0.2
    vy = py * (1.0 - l) / 0.2
    
    ox = np.zeros_like(px)
    oy = np.zeros_like(px)
    oz = np.zeros_like(px)
    
    for i in range(1, 9):
        diff = np.abs(vx - vy) * 0.2
        ox += (np.sin(vx) + 1.0) * diff
        oy += (np.sin(vy) + 1.0) * diff
        oz += (np.sin(vy) + 1.0) * diff
        
        nvx = vx + np.cos(vy * i + t) / i + 0.7
        nvy = vy + np.cos(vx * i + i + t) / i + 0.7
        vx, vy = nvx, nvy
        
    ox = np.maximum(ox, 1e-5)
    oy = np.maximum(oy, 1e-5)
    oz = np.maximum(oz, 1e-5)
    
    exp_l = np.exp(-4.0 * l)
    
    rx = np.tanh(np.exp(py * 1.0) * exp_l / ox)
    ry = np.tanh(np.exp(py * -1.0) * exp_l / oy)
    rz = np.tanh(np.exp(py * -2.0) * exp_l / oz)
    
    r = np.clip(rx * 255, 0, 255).astype(np.uint8)
    g = np.clip(ry * 255, 0, 255).astype(np.uint8)
    b = np.clip(rz * 255, 0, 255).astype(np.uint8)
    
    rgb = np.dstack((r, g, b))
    surf = pygame.surfarray.make_surface(np.transpose(rgb, (1, 0, 2)))
    return pygame.transform.scale(surf, (w, h))

try:
    while True:
        # 1. Event Handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT: 
                pygame.quit(); exit()
            if event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1 and toggle_rect.collidepoint(event.pos):
                    show_world = not show_world
            if event.type == pygame.VIDEORESIZE:
                screen = pygame.display.set_mode((event.w, event.h), pygame.RESIZABLE)
                toggle_rect.centerx = event.w // 2
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RIGHT: speed_multi = min(16.0, speed_multi * 2.0 if speed_multi > 0 else 0.25)
                if event.key == pygame.K_LEFT: speed_multi = max(0.0, speed_multi / 2.0 if speed_multi > 0.25 else 0)
                if event.key == pygame.K_SPACE: speed_multi = 0 if speed_multi > 0 else 1.0

        # 2. Simulation Logic
        loops = int(speed_multi) if speed_multi >= 1 else (1 if random.random() < speed_multi else 0)
        for step in range(loops):
            # OPT4: Reset planning budget each simulation step
            _plan_budget[0] = MAX_PLANNERS_PER_TICK
            
            # OPT5: Batch weight matmul across all agents in one C-level call
            # Stack all weights (N, size, size) and last outputs (N, size)
            all_w = np.array([b.weights for b in brains])       # (100, 100, 100)
            all_o = np.array([b._last_outputs for b in brains]) # (100, 100)
            # One matmul replaces 100 serial np.dot calls
            all_net_in = np.matmul(all_w, all_o[..., np.newaxis]).squeeze(-1)  # (100, 100)
            # Distribute results back so each brain's tick() can use it
            for i in range(NUM_AGENTS):
                brains[i]._batched_net_in = all_net_in[i]
            
            for i in range(NUM_AGENTS):
                # OPT1: Removed orphaned get_sensors() call (was computed but never used)
                # Motor output uses cached _last_outputs — avoids extra get_outputs() call
                alive, ate = envs[i].update(brains[i]._last_outputs[-2:], brain=brains[i])
                
                if not alive:
                    # Lowered food reward slightly, increased wall penalty heavily
                    score = (envs[i].ticks) + (envs[i].food_count * 3000) - (envs[i].wall_contact_count * 20)
                    
                    if score > (k_score * 1.005):
                        k_score, k_gen, k_food = score, k_gen + 1, envs[i].food_count
                        # Each new King earns +3 max health (capped at 500)
                        k_max_health = min(500, k_max_health + 3)
                        brains[0] = brains[i]
                        with open(SAVE_FILE, "wb") as f:
                            pickle.dump({'brain': brains[0], 'score': k_score, 'generation': k_gen, 'food': k_food, 'max_health': k_max_health}, f)
                        print(f"[Cycle {k_gen}] Score: {int(k_score)} Food: {k_food} MaxHP: {k_max_health}")
                    else:
                        # SCORE DECAY: If they don't beat the King, lower the King's standard slightly.
                        # This prevents a "lucky run" from permanently blocking evolution!
                        k_score = max(0, k_score * 0.99999)
                    
                    brains[i] = deepseek_style_mutate(brains[0])
                    envs[i] = Environment(k_gen, k_max_health)
                    
            if step % 5 == 0:  
                pygame.event.pump()

        # 3. Rendering Phase — only ever draws the best agent (agent 0)
        screen.fill((10, 10, 12))
        scr_w, scr_h = screen.get_size()
        pw, ph = scr_w, scr_h - 30  # viewport minus bottom UI bar

        fast_mode = speed_multi > 4.0
        # skip_world: hide entity rendering when fast AND user toggled world off
        skip_world = not show_world

        if skip_world:
            # Shader background + minimal stats (no entity draw cost)
            t_sec = pygame.time.get_ticks() / 1000.0
            shader_surf = get_shader_surface(pw, ph, t_sec)
            screen.blit(shader_surf, (0, 0))

            cx, cy = pw // 2, ph - 30
            angle = pygame.time.get_ticks() / 200.0
            rad = 15
            pygame.draw.circle(screen, (100, 255, 100), (cx, cy), rad, 2)
            end_x = int(cx + np.cos(angle) * rad)
            end_y = int(cy + np.sin(angle) * rad)
            pygame.draw.line(screen, (255, 255, 255), (cx, cy), (end_x, end_y), 2)
            screen.blit(big_font.render(f"SIMULATING AT {speed_multi}X SPEED...", True, (255, 255, 255)),
                        (cx - 160, cy - 40))
            hp = envs[0].health
            max_hp = envs[0].max_health
            screen.blit(big_font.render(f"FOOD: {envs[0].food_count} | HEALTH: {int(hp)} / {int(max_hp)}",
                                        True, (200, 200, 220)), (15, 50))
        else:
            # Full world render for best agent only
            env0 = envs[0]
            if (env0.agent_pos[0] <= 0.5 or env0.agent_pos[0] >= 49.5 or
                    env0.agent_pos[1] <= 0.5 or env0.agent_pos[1] >= 49.5):
                screen.fill((60, 0, 0))

            def to_p(pos):
                return [int((pos[0] / 50.0) * pw), int((pos[1] / 50.0) * ph)]

            # Food
            if env0.food_visible:
                for f_pos in env0.food_positions:
                    pygame.draw.circle(screen, (0, 255, 120), to_p(f_pos), 4)
            else:
                for f_pos in env0.food_positions:
                    pygame.draw.circle(screen, (30, 80, 30), to_p(f_pos), 4, 1)

            # Poison
            for p_pos in env0.poison_positions:
                fp = to_p(p_pos)
                pygame.draw.rect(screen, (255, 50, 50), (fp[0], fp[1], 6, 6))

            # Predator
            if env0.predator_active:
                pygame.draw.circle(screen, (255, 0, 100), to_p(env0.enemy_pos), 6)

            # Agent
            pygame.draw.circle(screen, (255, 255, 255), to_p(env0.agent_pos), 7)

            # HUD
            hp = env0.health
            max_hp = env0.max_health
            hp_pct = max(0.0, hp / max_hp)
            screen.blit(big_font.render(f"FOOD: {env0.food_count} | HEALTH: {int(hp)} / {int(max_hp)}",
                                        True, (200, 200, 220)), (15, 50))
            status_color = (50, 255, 50) if env0.food_visible else (200, 50, 50)
            status_text = "SENSES: ACTIVE" if env0.food_visible else "SENSES: BLIND (MEMORIZING)"
            screen.blit(big_font.render(status_text, True, status_color), (15, 78))

            bar_x, bar_y, bar_w, bar_h = 15, 108, min(300, pw - 30), 14
            pygame.draw.rect(screen, (40, 40, 40), (bar_x, bar_y, bar_w, bar_h), border_radius=4)
            bar_color = (50, 220, 80) if hp_pct > 0.5 else (220, 160, 30) if hp_pct > 0.25 else (220, 50, 50)
            pygame.draw.rect(screen, bar_color, (bar_x, bar_y, int(bar_w * hp_pct), bar_h), border_radius=4)
            pygame.draw.rect(screen, (100, 100, 100), (bar_x, bar_y, bar_w, bar_h), 1, border_radius=4)
            screen.blit(font.render(f"MAX HP EARNED: {int(max_hp)}", True, (120, 120, 140)),
                        (bar_x, bar_y + 18))

        # UI OVERLAY (bottom bar)
        ui_y = scr_h - 30
        pygame.draw.rect(screen, (0, 0, 0), (0, ui_y, scr_w, 30))
        msg = f"CYCLE: {k_gen} | BEST SCORE: {fmt_score(k_score)} | TOP FOOD: {k_food} | SPEED: {speed_multi}x"
        screen.blit(tiny_font.render(msg, True, (255, 255, 255)), (10, ui_y + 10))

        # System Resource Load (updated once per second)
        try:
            now = time.time()
            if now - last_sys_update > 1.0:
                sys_load_cache = (psutil.cpu_percent(), psutil.virtual_memory().percent)
                last_sys_update = now
            cpu_load, ram_load = sys_load_cache
            sys_msg = f"FPS: {int(clock.get_fps())} | CPU: {cpu_load}% | RAM: {ram_load}%"
            sys_surf = tiny_font.render(sys_msg, True, (150, 150, 160))
            screen.blit(sys_surf, (scr_w - sys_surf.get_width() - 10, ui_y + 10))
        except:
            pass

        # WORLD TOGGLE BUTTON (top centre)
        btn_color = (30, 110, 55) if show_world else (110, 35, 35)
        pygame.draw.rect(screen, btn_color, toggle_rect, border_radius=4)
        pygame.draw.rect(screen, (255, 255, 255), toggle_rect, 2, border_radius=4)
        btn_text = "WORLD: ON" if show_world else "WORLD: OFF"
        btn_surf = font.render(btn_text, True, (255, 255, 255))
        screen.blit(btn_surf, btn_surf.get_rect(center=toggle_rect.center))

        pygame.display.flip()
        clock.tick(60)

except KeyboardInterrupt:
    print("\n\n[!] EXIT SIGNAL RECEIVED")
    print(f"[+] Saving final brain state to {SAVE_FILE}...")
    with open(SAVE_FILE, "wb") as f:
        pickle.dump({'brain': brains[0], 'score': k_score, 'generation': k_gen, 'food': k_food, 'max_health': k_max_health}, f)
    print("[+] Save Complete. Simulation shut down safely.")
    pygame.quit()
    exit()