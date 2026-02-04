# Decision Engine - Automatic Review Decision Making

## Overview

The Decision Engine provides rule-based automatic decision recommendations for applications based on aggregated reviewer scores and variance metrics. This keeps quality high without requiring human intervention for clear-cut cases.

## Features

✅ **Enhanced Aggregation**

- Per-criterion averages across all reviewers
- Score variance (disagreement metric)
- Per-criterion variance analysis

✅ **Rule-Based Decision Engine**

- Automatic decision recommendations
- Configurable thresholds
- Confidence scoring
- Reasoning explanations

## How It Works

### Step 1 — Multiple Reviewers (2-3)

Already implemented: Reviewers are assigned by category + workload + conflict rules.

### Step 2 — Structured Rubric Scoring

Already implemented: Fixed criteria (e.g., innovation, feasibility, impact, team) scored on a bounded scale.

### Step 3 — Automatic Aggregation

**NEW**: Enhanced aggregation now computes:

- **Per-criterion averages**: Average score for each criterion across all reviewers
- **Overall average score**: Mean of all overall scores
- **Score variance**: Disagreement metric (higher = more disagreement)
- **Per-criterion variances**: Variance for each individual criterion

### Step 4 — Rule-Based Decision Engine

**NEW**: Automatic decision recommendations based on:

```
IF avg_score ≥ 8.0 AND variance ≤ 1.5 → APPROVE (high confidence)
IF avg_score ≤ 5.0 → REJECT
IF variance > 1.5 → REQUEST_MORE_INFO (disagreement detected)
Otherwise → REQUEST_MORE_INFO (human review recommended)
```

## Usage

### Basic Usage

```typescript
import {
  useDecisionEngine,
  useReviewAggregation,
} from "@/hooks/useReviewerAssignment";

// Get aggregation with enhanced metrics
const { data: aggregation } = useReviewAggregation(applicationId);

// Get decision engine recommendation
const { data: decision } = useDecisionEngine(applicationId, 2); // 2 expected reviewers

if (decision) {
  console.log("Recommended Decision:", decision.recommendedDecision);
  console.log("Confidence:", decision.confidence);
  console.log("Reasoning:", decision.reasoning);
  console.log("Can Auto-Approve:", decision.canAutoApprove);
}
```

### Custom Configuration

```typescript
const { data: decision } = useDecisionEngine(applicationId, 2, {
  approveThreshold: 8.0, // Minimum score for approval (1-10 scale)
  rejectThreshold: 5.0, // Maximum score for rejection (1-10 scale)
  varianceThreshold: 1.5, // Maximum variance for approval
  requireAllReviewers: true, // Require all reviewers before decision
});
```

### Accessing Enhanced Aggregation Metrics

```typescript
const { data: aggregation } = useReviewAggregation(applicationId);

if (aggregation) {
  // Overall metrics
  console.log("Average Score:", aggregation.average_score);
  console.log("Score Variance:", aggregation.score_variance);

  // Per-criterion metrics
  console.log("Per-Criterion Averages:", aggregation.per_criterion_averages);
  // Example: { innovation: 8.5, feasibility: 7.2, impact: 9.0, team: 6.8 }

  console.log("Per-Criterion Variances:", aggregation.per_criterion_variances);
  // Example: { innovation: 0.5, feasibility: 1.2, impact: 0.3, team: 2.1 }
}
```

## Decision Rules

### Default Thresholds (1-10 Scale)

- **Approve**: `avg_score ≥ 8.0` AND `variance ≤ 1.5`
- **Reject**: `avg_score ≤ 5.0`
- **Request Info**: `variance > 1.5` OR scores in middle range

### Confidence Calculation

Confidence is calculated based on:

1. **Score-based confidence**: How far the score is from thresholds
2. **Consensus-based confidence**: Agreement among reviewer recommendations
3. **Final confidence**: Weighted blend of both

High confidence (≥ 0.85) decisions can be auto-approved if desired.

## Integration Example

```typescript
// In a component
const ApplicationReview = ({ applicationId }: { applicationId: string }) => {
  const { data: aggregation } = useReviewAggregation(applicationId);
  const { data: decision } = useDecisionEngine(applicationId, 2);

  if (!aggregation || !decision) return <Loading />;

  return (
    <div>
      <h3>Review Summary</h3>
      <p>Average Score: {aggregation.average_score.toFixed(2)}/10</p>
      <p>Variance: {aggregation.score_variance.toFixed(2)}</p>

      <h4>Per-Criterion Averages</h4>
      {Object.entries(aggregation.per_criterion_averages).map(
        ([criterion, avg]) => (
          <div key={criterion}>
            {criterion}: {avg.toFixed(2)}/10 (Variance:{" "}
            {aggregation.per_criterion_variances[criterion].toFixed(2)})
          </div>
        )
      )}

      <h3>Decision Engine Recommendation</h3>
      <p>Decision: {decision.recommendedDecision}</p>
      <p>Confidence: {(decision.confidence * 100).toFixed(0)}%</p>
      {decision.canAutoApprove && (
        <Button onClick={handleAutoApprove}>Auto-Approve</Button>
      )}
      <ul>
        {decision.reasoning.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
    </div>
  );
};
```

## Benefits

1. **Quality Assurance**: Automatic filtering of low-quality applications
2. **Efficiency**: Reduces manual review time for clear cases
3. **Consistency**: Standardized decision criteria across all applications
4. **Transparency**: Clear reasoning for each recommendation
5. **Scalability**: Handles high volume without proportional human effort

## Future Enhancements

- Machine learning-based threshold optimization
- Category-specific decision rules
- Historical performance tracking
- Automatic threshold adjustment based on outcomes
