# FoodLoop — Engineering & Coding Rules

All development on the FoodLoop codebase must strictly adhere to these 12 non-negotiable rules:

1. **Inspect Before Modifying:** Never modify or delete existing code or working functionality without first reading, tracing, and understanding its implementation and caller dependencies.
2. **One Task at a Time:** Execute work in atomic, clearly bounded tasks. Never combine multi-phase features into a single unreviewed change.
3. **Prefer Vertical Slices:** Implement functional end-to-end paths (frontend input $\rightarrow$ API $\rightarrow$ storage $\rightarrow$ UI display) rather than speculative wide abstractions.
4. **Preserve Backward Compatibility:** Never rename or remove existing API payload keys or database fields without a verified compatibility mapping layer.
5. **No Invented Food-Safety Rules:** Do not invent arbitrary medical or microbiological safety rules, temperature limits, or shelf-life cutoffs. Rely on approved standards or maintain neutral operational descriptors.
6. **AI Is Not Safety Certification:** Never present computer vision models as scientific certifiers of food safety or microbiological freshness. Treat visual inference strictly as an eligibility and triage aid.
7. **Strict Scope Discipline:** Never implement unapproved features outside the active task scope (e.g., do not add auth, IoT, matching, or delivery during an intake task).
8. **The 8-Step Engineering Protocol:** Always follow the strict cycle:
   $$\text{Read} \longrightarrow \text{Understand} \longrightarrow \text{Plan} \longrightarrow \text{Implement} \longrightarrow \text{Test} \longrightarrow \text{Review} \longrightarrow \text{Commit} \longrightarrow \text{Update Docs}$$
9. **No Silent Specification Drift:** Never unilaterally alter approved product parameters, categories, or field requirements without explicit confirmation.
10. **Evidence-Based Completion:** No task is declared "done" without concrete verification evidence (build exits 0, test script passes, browser console has 0 errors).
11. **Do Not Blindly Overwrite:** Never write new code by wiping out working implementations without targeted diffs or verified replacements.
12. **Strict Separation of Implemented vs. Future:** Documentation, APIs, and UI must explicitly distinguish between what is already built and working versus what is planned for future phases.
