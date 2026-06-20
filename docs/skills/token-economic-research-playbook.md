# Token Economic Research Playbook

## 📋 Overview
This playbook provides a **modular approach** to token economic due diligence using 8 specialized skills. Instead of one monolithic analysis, you now have **flexible, reusable tools** for different research needs.

---

## 🎯 Quick Reference Guide

### Primary Research Pathways

| Pathway | Skills Used | Time Required | Best For |
|---------|-------------|---------------|----------|
| **Complete Due Diligence** | `token-identification` → `tokenomics-analysis` → `vesting-analysis` → `market-data-analysis` → `liquidity-analysis` → `holder-analysis` → `protocol-utility-analysis` → `team-governance-analysis` | 3-4 hours | Full investment assessment |
| **Quick Distribution Check** | `vesting-analysis` → `holder-analysis` | 15-30 min | Distribution risk only |
| **Market Quality Check** | `market-data-analysis` → `liquidity-analysis` | 20-40 min | Trading viability |
| **Team/Governance Check** | `team-governance-analysis` | 30-60 min | Team credibility |

---

## 🚀 Getting Started

### Prerequisites
Before starting your token research, gather these basic inputs:

```bash
# Collect this information first
✓ Token contract address (if available)
✓ Project name  
✓ Network/chain (if you have contract)
✓ Investment question/purpose
✓ Risk tolerance & budget
✓ Timeline for research
```

---

## 📊 WORKFLOW OPTIONS

### Option 1: Comprehensive Investigation (Recommended)
```
token-identification
    ↓
tokenomics-analysis  
    ↓
vesting-analysis
    ↓
market-data-analysis
    ↓
liquidity-analysis
    ↓
holder-analysis
    ↓
protocol-utility-analysis
    ↓
team-governance-analysis
```

### Option 2: Targeted Focused Analysis

#### **Distribution Risk Only:**
```
vesting-analysis → holder-analysis
```

#### **Trading Quality Only:**
```
market-data-analysis → liquidity-analysis
```

#### **Credibility Only:**
```
team-governance-analysis
```

---

## 🔍 INDIVIDUAL SKILLS OVERVIEW

### 1. **`token-identification`**
**Purpose**: Verify correct token, check authenticity
**Key Outputs**: Contract verification, cross-source confirmation

### 2. **`tokenomics-analysis`** 
**Purpose**: Analyze supply dynamics, inflation/deflation
**Key Outputs**: Supply structure, monetary policy assessment

### 3. **`vesting-analysis`**
**Purpose**: Distribution analysis, concentration risk
**Key Outputs**: Vesting timeline, holder distribution

### 4. **`market-data-analysis`**
**Purpose**: Current market performance
**Key Outputs**: Price, volume, volatility metrics

### 5. **`liquidity-analysis`**
**Purpose**: Trading infrastructure assessment
**Key Outputs**: Exchange depth, exit complexity

### 6. **`holder-analysis`**
**Purpose**: Holder distribution patterns
**Key Outputs**: Concentration, whale activity, velocity

### 7. **`protocol-utility-analysis`**
**Purpose**: Token utility within protocol
**Key Outputs**: Use cases, demand drivers

### 8. **`team-governance-analysis`**
**Purpose**: Team credibility & governance quality
**Key Outputs**: Team assessment, governance health

---

## 🎯 INTEGRATING RESULTS

### Risk Scoring Framework

Combine findings from all skills into a unified assessment:

```plaintext
SKILL ASSESSMENT SUMMARY:

1. Safety & Verification:   HIGH/MEDIUM/LOW
2. Tokenomics:             HIGH/MEDIUM/LOW  
3. Distribution:           HIGH/MEDIUM/LOW
4. Market Quality:         HIGH/MEDIUM/LOW
5. Trading Access:         HIGH/MEDIUM/LOW
6. Holder Base:            HIGH/MEDIUM/LOW
7. Protocol Utility:       HIGH/MEDIUM/LOW
8. Team & Governance:      HIGH/MEDIUM/LOW

FINAL RATING: LOW/MEDIUM/HIGH
```

### Investment Decision Logic

**✅ INVEST** - When:
- Most skills = HIGH
- No critical low scores
- Favorable risk/reward ratio
- Appropriate allocation size

**⚠️ MONITOR** - When:
- Mixed scores (3-4 HIGH, 3-4 MEDIUM)
- Some moderate risks
- Need more information
- Smaller position sizes

**❌ AVOID** - When:
- Any critical skill = LOW
- Concentration/tampering risks
- Poor governance
- Unsustainable fundamentals
```

---

## 🛠️ EXECUTION GUIDES

### Quick Distribution Check (15-30 minutes)
```bash
# Run these two skills in sequence
execute: vesting-analysis
execute: holder-analysis
# Focus on concentration risk assessment
```

### Trading Quality Check (20-40 minutes)  
```bash
# Run these two skills
execute: market-data-analysis
execute: liquidity-analysis
# Assess entry/exit viability
```

### Credibility Check (30-60 minutes)
```bash
# Run governance analysis
execute: team-governance-analysis
# Assess team and governance health
```

### Full Due Diligence (3-4 hours)
```bash
# Sequential execution
execute: token-identification
execute: tokenomics-analysis
execute: vesting-analysis
execute: market-data-analysis
execute: liquidity-analysis
execute: holder-analysis
execute: protocol-utility-analysis
execute: team-governance-analysis
```

---

## 📊 OUTPUT TEMPLATES

### Standard Research Report Format
```markdown
# Token Research Report: [Token Name]

## Executive Summary
**Risk Rating**: [HIGH/MEDIUM/LOW]
**Recommendation**: [INVEST/MONITOR/AVOID]

### Core Findings
- **Safety & Verification**: [HIGH/MEDIUM/LOW]
- **Tokenomics**: [HIGH/MEDIUM/LOW]  
- **Distribution**: [HIGH/MEDIUM/LOW]
- **Market Quality**: [HIGH/MEDIUM/LOW]
- **Trading Access**: [HIGH/MEDIUM/LOW]
- **Holder Base**: [HIGH/MEDIUM/LOW]
- **Protocol Utility**: [HIGH/MEDIUM/LOW]
- **Team/Governance**: [HIGH/MEDIUM/LOW]

## Investment Thesis
[Arguments supporting investment decision]

## Key Risks
[Major risk factors identified]

## Monitoring Plan
[Ongoing tracking requirements]
```

---

## 🎯 DECISION TREE

### Risk-Based Prioritization

```plaintext
START → token-identification skill
          ↓
     CAN CONFIRM?
     YES → Proceed to tokenomics
     NO  → Flag as high risk

tokenomics-analysis
          ↓
     SUSTAINABLE?  
     YES → Proceed to vesting
     NO  → AVOID token

vesting-analysis
          ↓ 
     CONCENTATION?  
     HIGH → Investigate further
     MEDIUM → Monitor
     LOW → Continue
```

### Quick-Stop Risk Flags

**Stop Immediate Research:**
1. Token ID fails verification
2. Tokenomics clearly unsustainable
3. Vesting shows extreme concentration
4. Holder base mostly unknown
5. Team completely anonymous
```

---

## 📈 MONITORING FRAMEWORK

### On-Going Tracking Focus Areas
- **Distribution Events**: Major unlock dates
- **Market Changes**: Price/volume deviations
- **Governance Updates**: Team changes, proposals  
- **Protocol Updates**: Feature releases, integrations

### Monitoring Frequency
```plaintext
HIGH Risk:     Weekly tracking
MEDIUM Risk:   Monthly monitoring
LOW Risk:      Quarterly reviews
```

---

## 🔄 CONTINUOUS IMPROVEMENT

### Playbook Evolution
1. **Add new skills** based on emerging needs
2. **Refine existing skills** using research feedback
3. **Create specialized workflows** for different token types
4. **Share insights** across research team
5. **Update templates** based on lessons learned

### Skill Development Prioritization
- **Immediate**: Focus on common risk patterns
- **Short-term**: Add crypto-specific metrics
- **Long-term**: Integrate AI-assisted analysis

---

## 🎯 USAGE EXAMPLES

### Example 1: New Token Evaluation
```bash
# Comprehensive analysis for unReviewed opportunity
execute: token-identification
execute: tokenomics-analysis
execute: vesting-analysis
execute: market-data-analysis
execute: liquidity-analysis
execute: holder-analysis
execute: protocol-utility-analysis
execute: team-governance-analysis
# Result: Full investment thesis with risk score
```

### Example 2: Quick Competitor Analysis
```bash
# Compare two existing protocols
# Protocol A: Full due diligence sequence
# Protocol B: Same full sequence  
# Result: Head-to-head investment recommendation
```

### Example 3: Risk-Only Investigation
```bash
# High concentration risk focus
execute: vesting-analysis
execute: holder-analysis
# Result: Risk assessment only
```

---

## 📊 SUCCESS METRICS

### Research Quality Indicators
- **Verification Rate**: % of tokens passing initial verification
- **Risk Detection**: % of high-risk tokens caught early
- **False Positive Rate**: % of medium-risk tokens misclassified
- **Decision Accuracy**: Alignment between assessment and actual outcomes

### Efficiency Metrics
- **Time per Analysis**: Hours reduced through skill specialization
- **Coverage Scope**: Number of aspects analyzed per skill
- **Resource Utilization**: Optimization of research effort
- **Reproducibility**: Consistent results across similar tokens

---

This modular playbook provides the flexibility to conduct everything from **quick sanity checks** to **comistic due diligence** workflows. The individual skills can be run in sequence for thorough analysis or picked selectively for targeted investigations, creating a living, adaptable research framework.

The key advantage is **scalability** - the system grows with your research capabilities while maintaining consistency in methodology and quality standards.
```