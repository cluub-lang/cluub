# Voice coding

Cluub is designed to be **spoken**. Keywords are ordinary English words, and every operator has a word form. That makes dictation tools such as **Wispr Flow** (or the dictation built into macOS, Windows and phones) practical for writing code.

| Say | Cluub |
|---|---|
| "if total is greater than one hundred" | `if total is greater than 100` |
| "require title is not empty comma quote title is required quote" | `require title is not empty, "Title is required"` |
| "let price equals cost times two" | `let price = cost times 2` |
| "return a divided by b" | `return a divided by b` |
| "if done and not archived" | `if done and not archived` |
| "button quote save quote comma on click save" | `button "Save", on click save` |
| "ask ai quote summarize notes quote" | `ask ai "summarize {notes}"` |

Accepted word forms: `is`, `is not`, `equals`, `is greater than`, `is less than`, `is at least`, `is at most`, `is empty`, `is one of`, `has`, `and`, `or`, `not`, `plus`, `minus`, `times`, `divided by`, `yes`/`no` for true/false.

## Tips for dictation

* Dictate one line at a time; Cluub's indentation is 2 spaces per level, and the playground editor indents for you after lines like `if …`, `view`, `action …`.
* If a word lands in the wrong place, `cluub dev` points at it immediately with a suggestion ("Did you mean `heading`?").
* Use `cluub make "…"` for bigger changes: say what you want in plain English and let the AI write the code.
