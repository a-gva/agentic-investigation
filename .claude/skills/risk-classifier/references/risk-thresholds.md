# Risk Thresholds (GAIN Corpus)

| Category | Threshold | Source field |
|----------|-----------|--------------|
| revolving_door | any govt title in covered_position | Senate/House lobbyist fields |
| foreign_influence | foreign_entities non-empty | Senate/House filing metadata |
| contribution_routing | payee ≠ honoree | contribution_items |
| contribution_routing | amount > $1,000 | contribution_items.amount |
| undisclosed_spend | income AND expenses both null on Q filing | Senate/House quarterly |
| senate_house_mismatch | amount delta > $1 between paired filings | senate_id crosswalk |
| say_vs_pay | press topic + lobbying same issue ±1 quarter | congress_press + LDA |

Categories requiring external data (optional Phase 7 only):

- quid_pro_quo — needs FEC + vote records
- dark_money — needs FEC independent expenditure data
- earmark_correlation — needs appropriations data
