# Commercial Pricing & Cost Models

## Pricing Engine Calculations
Implemented in `server/src/services/planningService.ts`:

1. **Total Estimated Hours**:
   $$H_{est} = \sum_{w \in \text{WorkItems}} w.\text{estimatedHours}$$

2. **Internal Labor Cost**:
   $$\text{LaborCost} = \sum_{r \in \text{Allocations}} \left(r.\text{allocatedHours} \times r.\text{costRate}\right)$$

3. **Subtotal with Contingency & Overhead**:
   $$\text{Subtotal} = (\text{LaborCost} + \text{Expenses}) \times \left(1 + \frac{\text{Contingency}\%}{100}\right)$$

4. **Target Sell Price (Markup)**:
   $$\text{TargetPrice} = \text{Subtotal} \times \left(1 + \frac{\text{Markup}\%}{100}\right)$$

5. **Discounted Net Price**:
   $$\text{NetPrice} = \text{TargetPrice} \times \left(1 - \frac{\text{Discount}\%}{100}\right)$$

6. **Gross Margin**:
   $$\text{GrossMargin}\% = \frac{\text{NetPrice} - \text{TotalCost}}{\text{NetPrice}} \times 100$$
