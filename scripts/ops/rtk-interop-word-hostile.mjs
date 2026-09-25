/** Admission of independently read hostile proofs; never count positive carriers. */
export const WORD_HOSTILE_CAMPAIGN = 'WORD_HOSTILE_V1';
export const WORD_HOSTILE_FIELDS = Object.freeze(['TEXT','ORDER','UNICODE_IME_LOCALE','STYLES','NOVEL_SCENE_STRUCTURE',
  'TRACKED_REVIEW_SEMANTICS','NOTES','FOOTNOTES_ENDNOTES','COMMENTS','IDENTIFIERS_ANCHORS','METADATA','SECTIONS','TABLES','MEDIA_ASSETS']);
export const WORD_HOSTILE_CELLS = Object.freeze(WORD_HOSTILE_FIELDS.flatMap(field=>['C1','C2','C3'].flatMap(route=>
  ['SOURCE_RUNTIME','PACKAGED_BUILD_RUNTIME'].map(profile=>`${field}__MALFORMED_HOSTILE_INPUT__${route}__${profile}`))).sort());
const must = (ok, code) => {if(!ok)throw new Error(code);};
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const sha = value => typeof value==='string' && /^[a-f0-9]{64}$/u.test(value);

export function wordHostileCampaign(row) {
  const suffix=row.runId.split('__').at(-1);
  const hostile=suffix.startsWith('hostile-v1-') || suffix.startsWith('review-return-hostile-v1-');
  if(!hostile)return '';
  must(row.volume==='MULTI_SCENE' && ['C1','C2','C3'].includes(row.route)
    && row.recipe===(row.route==='C1'?'C1_REVIEW_RETURN':'DEFAULT')
    && suffix.startsWith(row.route==='C1'?'review-return-hostile-v1-':'hostile-v1-'),'HOSTILE_CAMPAIGN_SCOPE');
  return WORD_HOSTILE_CAMPAIGN;
}

export function selectedManuscriptProofs(raw) {
  return raw.campaign===WORD_HOSTILE_CAMPAIGN ? raw.hostileProofs : raw.fieldProofs;
}

export function validateWordHostileRaw(raw,{row,hops,oracles,admittedCells}) {
  const campaign=wordHostileCampaign(row);
  if(!campaign){must(raw.campaign===undefined && raw.hostileProofs===undefined,'HOSTILE_UNBOUND_PROOF');return true;}
  must(raw.campaign===campaign && same(admittedCells,WORD_HOSTILE_CELLS),'HOSTILE_POLICY_SCOPE');
  const proofs=raw.hostileProofs,cycles=row.route==='C3'?5:1;
  must(Array.isArray(proofs) && same(proofs.map(p=>p.field),WORD_HOSTILE_FIELDS),'HOSTILE_FIELD_SET');
  must(raw.roundProofs?.length===cycles,'HOSTILE_CYCLE_COUNT');
  const byRound=Array.from({length:cycles},()=>new Set());
  for(const proof of proofs) {
    must(proof.cellId===`${proof.field}__MALFORMED_HOSTILE_INPUT__${row.route}__${row.profile}`
      && admittedCells.includes(proof.cellId) && proof.runId===row.runId && proof.status==='PASS'
      && proof.outcome==='REJECTED_INVALID_NO_MUTATION' && proof.typedResult===true && proof.mutationCount===0
      && proof.requiredCycles===cycles && same(proof.requiredHops,hops) && same(proof.oracles,oracles)
      && proof.authorityScope==='CANONICAL_PROJECT_AND_AUTHORING_UNCHANGED_DERIVED_DIAGNOSTICS_RETAINED','HOSTILE_PROOF_SCOPE');
    must(proof.rounds?.length===cycles,'HOSTILE_FIELD_ROUNDS');
    for(const [index,round] of proof.rounds.entries()) {
      const c=round.classification;
      must(round.ordinal===index+1 && round.mutationCount===0 && Number.isSafeInteger(round.protectedFileCount)
        && round.protectedFileCount>=7 && [round.sourceSha256,round.artifactSha256,round.probeSha256,round.canonicalStateSha256].every(sha)
        && round.sourceSha256===raw.roundProofs[index].returnedSha256 && round.sourceSha256!==round.artifactSha256
        && c?.field===proof.field && c.invalid===true && /^[A-Z][A-Z0-9_]{2,100}$/u.test(c.reason)
        && c.sourceSha256===round.sourceSha256 && c.artifactSha256===round.artifactSha256
        && [round.intakeCode,round.applyCode].every(code=>typeof code==='string' && /^[A-Z][A-Z0-9_]{2,200}$/u.test(code)),'HOSTILE_INDEPENDENT_ROUND');
      byRound[index].add(round.artifactSha256);
    }
  }
  must(byRound.every(hashes=>hashes.size===WORD_HOSTILE_FIELDS.length),'HOSTILE_DISTINCT_INPUTS');
  return true;
}
