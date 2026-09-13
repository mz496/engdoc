---
create-date: 2026-09-12, 23:40:00
type: example
tags: [engdoc, example, tbl]
link: https://claude.ai/code/artifact/3e084942-4c22-47c8-ac24-f5f0c4201293
order: 8
---
# Example: Relational DB table

- **A relational table shows what is in one table, where an ERD shows how tables relate.** Key columns are tinted, a json column is clipped to one line and gives up the whole value on hover, and a wide table pins the columns that identify a row.
- **A `tbl` fence is a label, columns and rows.**

### A table shows what is in one table, where an ERD shows how tables relate.

- **Key columns are tinted, not just badged.** A reader scanning for the join finds a coloured band faster than a two-letter tag, so the tag is there for naming it and the band is there for finding it.
- **The primary key reuses the ERD's tint.** Same colour, same meaning, across both components. A reader who learned it on one figure does not relearn it on the other.
- **Values are real, not lorem.** Two rows sharing a visit_id and a room_id is the fact the figure exists to show. Placeholder data would show the shape and hide the point.
- **Reach for this when the argument is about rows.** Duplicate keys, a status that should never coexist with another, a column that is null more often than anyone expects. An ERD cannot say any of those.

#### Things to note

- **Every cell is addressable.** Each one carries its row id and column name, so a walkthrough can light a single cell or a whole row without the spec listing anything twice.
- **Columns size themselves to their widest value.** There is no column width in the spec, so a longer status string widens its own column and nothing else moves.

```tbl tbl/line-items
label: line_items
alt: >-
  A line_items table with a tinted primary key column, two tinted foreign key columns, and four plain columns
  of values.
columns:
  - name: id
    type: int
    key: pk
  - name: visit_id
    type: int
    key: fk
  - name: room_id
    type: int
    key: fk
  - name: trade
    type: text
  - name: qty
    type: numeric
  - name: status
    type: text
rows:
  - - '1'
    - '42'
    - '7'
    - drywall
    - '120.00'
    - approved
  - - '2'
    - '42'
    - '7'
    - paint
    - '120.00'
    - approved
  - - '3'
    - '42'
    - '9'
    - flooring
    - '88.50'
    - pending
  - - '4'
    - '43'
    - '3'
    - paint
    - '64.00'
    - pending
```

### A clipped column is one line in the grid and the whole value on hover.

- **The clipped line is the point of comparison, not the data.** Twenty-odd characters is enough to see that two rows differ and which one looks wrong. Reading the value itself is a separate act, so it gets a separate gesture.
- **A json column clips on its own, and any other column asks with `clip: n`.** n is how many characters stay in the cell. Here `metadata` and `result` are json and `note` is free text clipped at twenty-eight.
- **A clipped cell carries a dotted underline, so a reader knows there is more.** It is the same mark a call graph row or an ERD column wears when hovering it opens a note. Cells that fit are left alone, so an unmarked cell is the whole value.
- **The full value is formatted, not re-flowed.** A json value comes back as indented json in a fixed-width tooltip, the form anyone debugging it already reads. A clipped sentence sets in the body face and wraps.
- **Cells hold real objects in the spec.** The renderer does the stringifying, so a spec author writes the structure once and never maintains a compact copy alongside a pretty one.
- **Keyboard gets there too.** Each clipped cell is focusable and shows the same tooltip on focus, dismissed with escape.

#### Things to note

- **The row here is a real failure.** Upload 812 carries a group_index with a null group_id, which is the exact shape that orphans a segment. Two clipped lines side by side are enough to see it.
- **Clip the column that would otherwise set the table's width.** A free text note runs to a paragraph, and one long row would push every other column off the edge of the figure.
- **The tooltip is positioned in viewport space and is opaque.** A tooltip inside the figure would be clipped by the figure's own horizontal scroll, which is where a wide table puts json columns.

```tbl tbl/clipped-cols
label: capture_uploads
alt: >-
  An uploads table whose metadata and result columns hold json and whose note column is free text clipped
  to twenty-eight characters. Clipped cells carry a dotted underline and give up the whole value on hover.
columns:
  - name: id
    type: int
    key: pk
  - name: visit_id
    type: int
    key: fk
  - name: state
    type: text
  - name: metadata
    type: jsonb
    json: true
  - name: result
    type: jsonb
    json: true
  - name: note
    type: text?
    clip: 28
rows:
  - id: u1
    cells:
      - '811'
      - '42'
      - processed
      - device: iPhone15,2
        os: '18.1'
        segments: 3
        group_id: a71c
      - rooms: 6
        frames: 4120
        trades:
          - paint
          - drywall
      - Reprocessed once after the first pass dropped the hallway segment. Second pass clean.
  - id: u2
    cells:
      - '812'
      - '42'
      - skipped
      - device: iPhone15,2
        os: '18.1'
        segments: 2
        group_index: 1
        group_id: null
      - skip_processing: true
        reason: group_index without group_id
      - Skipped by the guard. The client sent a group index with no group, which is the orphaned segment shape.
  - id: u3
    cells:
      - '813'
      - '43'
      - uploaded
      - device: SM-G991B
        os: '14'
        segments: 1
      - {}
      - null
```

### A wide table scrolls, but the columns that identify a row stay pinned.

- **Scrolling alone loses the reader.** At column eleven there is nothing on screen saying which row they are looking at, so every fact they find is unattributable and they scroll back to check.
- **Set `freeze` to the number of columns that name a row.** Usually the primary key and the one foreign key the argument is about. Everything after it scrolls.
- **The seam is left visible on purpose.** Two adjacent borders are the cue that the left side is pinned. Hiding the join would make the pin feel like a rendering accident when the rest moves.
- **Both halves are ordinary specs.** The parent is sliced into two and each half goes through the same renderer, so freezing costs the renderer nothing and row ids survive into both.
- **Eleven columns is usually a sign to split the figure.** Pinning makes a wide table readable. It does not make a wide table a good argument, and most of these want to be two narrower tables about two separate claims.

```tbl tbl/wide
label: visit_line_items
freeze: 2
alt: >-
  A wide line-items table with eleven columns. The id and visit_id columns are pinned on the left while the
  remaining columns scroll horizontally.
columns:
  - name: id
    type: int
    key: pk
  - name: visit_id
    type: int
    key: fk
  - name: room_id
    type: int
    key: fk
  - name: pricing_item_id
    type: int
    key: fk
  - name: trade
    type: text
  - name: unit_type
    type: text
  - name: qty
    type: numeric
  - name: unit_cost_cents
    type: int
  - name: total_cents
    type: int
  - name: status
    type: text
  - name: reviewed_at
    type: timestamptz
rows:
  - - '1'
    - '42'
    - '7'
    - '310'
    - drywall
    - SF
    - '120.00'
    - '285'
    - '34200'
    - approved
    - 2026-08-24 11:02
  - - '2'
    - '42'
    - '7'
    - '412'
    - paint
    - SF
    - '120.00'
    - '140'
    - '16800'
    - approved
    - 2026-08-24 11:02
  - - '3'
    - '42'
    - '9'
    - '518'
    - flooring
    - SF
    - '88.50'
    - '690'
    - '61065'
    - pending
    - ''
  - - '4'
    - '43'
    - '3'
    - '412'
    - paint
    - SF
    - '64.00'
    - '140'
    - '8960'
    - pending
    - ''
```

### A table spec is a label, columns and rows.

- **A row is an array of values in column order, or an object with an id.** Give it an id when a walkthrough needs to name it. Otherwise it is `r0`, `r1`, and so on by position.
- **Only `key` changes how a column looks.** Set it to pk or fk for the tint and the tag. Everything else about the layout is measured.

| spec reference — component 05 | |
| --- | --- |
| table | { label, alt?, columns:[…], rows:[…] } |
| column | { name, type?, key?:'pk'\|'fk' } · pk tints with the activation colour, fk with the surface tint |
| row | [ value, … ] in column order · or { id, cells:[…] } to name it |
| json column | { name, type, json:true } · cells hold real objects · clipped to one line, formatted on hover and on focus |
| clip | { name, type, clip: n } on any column · a value longer than n characters shows its first n and the whole value on hover and on focus · json columns clip at 24 unless told otherwise |
| freeze | top-level `freeze: n` · the first n columns render as their own table and the rest scroll beside them |
| walkthrough keys | `rowId` for a row · `rowId.column` for one cell · the key bands and the grid are structure and never dim |

A row id prefix-matches its own cells, so focusing `run` lights every cell in that row and focusing `run.state` lights one.
