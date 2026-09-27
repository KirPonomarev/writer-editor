# Fresh identity for an ordinary Word file selection

Task: WORD_REVIEW_SELECTION_IDENTITY_20260927
Base: 794c56257c7533b2344233b9673e91edc8bf3b26
Authority: owner's autonomous Word correction plan, repeated ordinary return.

O: opening a newly edited DOCX through the native picker works in the same
process; an explicitly reused request with different bytes remains rejected.
T: native selection intent -> main-generated request identity -> existing digest
guard -> validated artifact -> existing private Apply and Command Kernel path.
H: the constant default request ID conflates distinct picker actions. A fresh
opaque nonce per action removes this collision without relaxing replay checks.
B: preserve caller-supplied IDs, artifact/round authentication, project identity,
generation/CAS, cancellation and canonical state. No schema, UI or dependency
change. Rollback is the bounded main/test/admission diff.
P: actual-main selected-file command regression, explicit-ID mutated payload
negative and same-payload repeat; physical SOURCE/PACKAGED repeated selections;
mandatory tests, CI, delivery and exact merged-head checks.
I: exact base above; native file selection, bytes digest and original explicit
request ID remain independently checked. A request nonce gives no write authority.

FEATURE_INTEGRATION_MANIFEST_V1: existing-seam word-review-selection-identity.
Product plane and Command Kernel are unchanged. The request guard is transient
main-owned operation state; Core still owns PROJECT_STATE and no renderer writes
storage. DERIVED_STATE previews remain artifact-bound and unsaved authoring is
protected. Commands, Queries, Effects, private admission, lease and recovery are
the existing contracts. No new product port, worker or interface surface.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE; no design or interface contract change.

The observed native run first opened an unchanged export, then Word changed its
status. The second native selection in the same process was rejected with
RTK_DOCX_ACTIVATION_DUPLICATE_REQUEST_MUTATED_PAYLOAD. This was a no-write failure.
The regression test must fail on the old default and retain rejection when a
caller deliberately supplies the same explicit request ID with changed bytes.
This repair adds no officially accepted cells and does not close full P1c.
