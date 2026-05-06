# Directives for GitHub CLI Bot

## Task
Fix an `AttributeError` in `train_headless.py` that causes the script to crash with:
`AttributeError: 'ImprovedCTRNN' object has no attribute 'tick'`

## Context
The issue is caused by an indentation error. The function `def forward_plan` is completely unindented (column 0), effectively removing it from the `ImprovedCTRNN` class. Because `def tick` is indented at 4 spaces directly beneath it, the Python interpreter is treating `tick` as a nested internal function inside `forward_plan` rather than a method of `ImprovedCTRNN`.

## Instructions

1. **Target File:** `train_headless.py`
2. **Find the target code block:**
   Locate `def forward_plan` (around line 101):
   ```python
   def forward_plan(self, env_copy_func, steps=PLANNING_HORIZON):
       plans = []
       current_state = self.voltages.copy()
   ```
3. **Fix the Indentation:**
   - Add exactly **4 spaces** of indentation to `def forward_plan(...)`.
   - Add exactly **4 extra spaces** to the entire body of `forward_plan` (so it sits at 8 spaces total).
   - Stop indenting when you reach `def tick(`. 
   - `def tick(` is already correctly indented at 4 spaces, so leave it and its body as-is.

### Expected Corrected Code Structure
Replace the current block with this corrected indentation:

```python
    def get_outputs(self, uncertainty=None):
        active_voltages = np.clip(self.voltages - (self.adaptation * 1.5), -50, 50)
        if uncertainty is not None:
            self.thinking_mode = 1 if uncertainty > self.mode_switch_threshold else 0
        if self.thinking_mode == 0:
            outputs = 1.0 / (1.0 + np.exp(-active_voltages))
        else:
            attended = self.sparse_attention(active_voltages)
            outputs = 1.0 / (1.0 + np.exp(-attended))
        return outputs

    def forward_plan(self, env_copy_func, steps=PLANNING_HORIZON):
        plans = []
        current_state = self.voltages.copy()
        current_adaptation = self.adaptation.copy()
        original_mode = self.thinking_mode
        self.thinking_mode = 0
        for action_variation in np.linspace(-0.5, 0.5, 3):
            sim_voltages = current_state.copy()
            sim_adaptation = current_adaptation.copy()
            total_reward = 0
            for step in range(steps):
                self.voltages = sim_voltages
                self.adaptation = sim_adaptation
                outputs = self.get_outputs()
                _ = (
                    outputs[-2:] + action_variation
                )  # F841: Assign to _ to indicate intentional unused
                total_reward += np.random.randn() * 0.1
                sim_derivative = (-sim_voltages + self.biases) / self.time_constants
                sim_voltages = sim_voltages + sim_derivative * 0.1
                sim_adaptation = (
                    sim_adaptation + (outputs * 0.1 - sim_adaptation * 0.05) * 0.1
                )
            plans.append((action_variation, total_reward))
        self.thinking_mode = original_mode
        self.voltages = current_state
        self.adaptation = current_adaptation
        best_action = max(plans, key=lambda x: x[1])[0]
        return best_action

    def tick(
        self,
        dt,
        sensors,
        uncertainty=None,
        use_planning=False,
        precomputed_net_input=None,
    ):
```

4. **Commit & Push:**
   Commit the fix with a message matching conventional commits: 
   `fix: correct ImprovedCTRNN method indentation for forward_plan and tick`
```
