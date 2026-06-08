# Source Field Mappings

Maps GAIN corpus fields to normalized `records` columns. Full data manual: [RAW_DATA_OVERVIEW.md](../../../../RAW_DATA_OVERVIEW.md).

## Senate filings (`lobbying_activities[]`)

| Corpus field | records column | notes |
|--------------|----------------|-------|
| `registrant.name` | `entity_name` | lobbying firm |
| `client.name` | `counterparty` | client org |
| `income` / `expenses` | `amount_cents` | per activity or filing |
| `filing_uuid` | `metadata.filing_uuid` | primary citation |
| `lobbyists[].covered_position` | `metadata.covered_position` | revolving door signal |
| `foreign_entities[]` | `metadata.foreign_entities` | foreign influence |
| `general_issue_code` | `tags` | ALI code |

## Senate contributions (`contribution_items[]`)

| Corpus field | records column |
|--------------|----------------|
| `contributor_name` | `entity_name` |
| `payee` | `counterparty` |
| `honoree` | `metadata.honoree` |
| `amount` | `amount_cents` |
| `type` | `metadata.contribution_type` |

## House XML

| Corpus field | records column |
|--------------|----------------|
| `organizationName` | `entity_name` |
| `clientName` | `counterparty` |
| `senateID` / `houseID` | `metadata.senate_id` / `metadata.house_id` |
| `lobbyists/lobbyist/coveredPosition` | `metadata.covered_position` |
| `specific_issues/description` | `description` |

## Congress press JSONL

| Corpus field | records column |
|--------------|----------------|
| `member.name` | `entity_name` |
| `member.bioguide_id` | `metadata.bioguide_id` |
| `title` + `text` | `description` |
| `date` | `date` |
| `url` | `metadata.url` |
| — | `record_type` = `press_release` |
| — | `source` = `congress_press` |
