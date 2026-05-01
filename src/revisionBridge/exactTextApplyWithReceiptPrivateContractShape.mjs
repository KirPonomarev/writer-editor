import { canonicalHash } from './reviewIrKernel.mjs';
import { runExactTextApplyWithReceiptPrivateContractBrief } from './exactTextApplyWithReceiptPrivateContractBrief.mjs';

const RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_RESULT_002B';
const DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_DECISION_002B';
const SHAPE_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_SHAPE_V1_002B';
const SOURCE_002A_RESULT_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_RESULT_002A';
const SOURCE_002A_DECISION_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_DECISION_002A';
const SOURCE_002A_BRIEF_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CONTRACT_BRIEF_V1_002A';
const OWNER_PACKET_KIND = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_OWNER_PACKET_002B';
const TARGET_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B';
const NEXT_CONTOUR = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C';
const BINDING_HEAD_SHA = 'eee8e4df010ba4f6c84fd9f471228f0c1720fc08';

export const EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES = Object.freeze({
  SOURCE_002A_RESULT_REQUIRED: 'SOURCE_002A_RESULT_REQUIRED',
  SOURCE_002A_RESULT_MISMATCH: 'SOURCE_002A_RESULT_MISMATCH',
  SOURCE_002A_DECISION_MISMATCH: 'SOURCE_002A_DECISION_MISMATCH',
  SOURCE_002A_BLOCKED: 'SOURCE_002A_BLOCKED',
  SOURCE_002A_DECISION_MALFORMED: 'SOURCE_002A_DECISION_MALFORMED',
  SOURCE_002A_CONTRACT_BRIEF_MISMATCH: 'SOURCE_002A_CONTRACT_BRIEF_MISMATCH',
  SOURCE_002A_FAILURE_CONTRACT_MISMATCH: 'SOURCE_002A_FAILURE_CONTRACT_MISMATCH',
  INHERITED_CHAIN_REVALIDATION_FAILED: 'INHERITED_CHAIN_REVALIDATION_FAILED',
  OWNER_PACKET_REQUIRED: 'OWNER_PACKET_REQUIRED',
  OWNER_PACKET_INVALID: 'OWNER_PACKET_INVALID',
  OWNER_PACKET_BINDING_MISMATCH: 'OWNER_PACKET_BINDING_MISMATCH',
  OWNER_PACKET_TARGET_MISMATCH: 'OWNER_PACKET_TARGET_MISMATCH',
  OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN',
  OWNER_SHAPE_POLICY_MISSING: 'OWNER_SHAPE_POLICY_MISSING',
  SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN: 'SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN',
  SHAPE_UNKNOWN_FIELD_FORBIDDEN: 'SHAPE_UNKNOWN_FIELD_FORBIDDEN',
  NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
  SHAPE_SCHEMA_FIELD_MISSING: 'SHAPE_SCHEMA_FIELD_MISSING',
  CALLABLE_FIELD_FORBIDDEN: 'CALLABLE_FIELD_FORBIDDEN',
  USER_PROJECT_PATH_FORBIDDEN: 'USER_PROJECT_PATH_FORBIDDEN',
  PORT_IMPLEMENTATION_FORBIDDEN: 'PORT_IMPLEMENTATION_FORBIDDEN',
  PRODUCT_RUNTIME_FORBIDDEN: 'PRODUCT_RUNTIME_FORBIDDEN',
  PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN',
  RUNTIME_WIRING_FORBIDDEN: 'RUNTIME_WIRING_FORBIDDEN',
  APPLY_EXECUTION_FORBIDDEN: 'APPLY_EXECUTION_FORBIDDEN',
  PUBLIC_COMMAND_SURFACE_FORBIDDEN: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN',
  UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN',
  APPLYTXN_RECOVERY_RELEASE_FORBIDDEN: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN',
  USER_PROJECT_MUTATION_FORBIDDEN: 'USER_PROJECT_MUTATION_FORBIDDEN',
});

const FALSE_FLAGS = Object.freeze({
  productApplyRuntimeAdmitted: false,
  publicRuntimeAdmitted: false,
  publicAdapterImplementationAdmitted: false,
  runtimeWiringAdmitted: false,
  applyExecutionImplemented: false,
  publicSurfaceClaimed: false,
  ipcSurfaceClaimed: false,
  preloadExportClaimed: false,
  menuSurfaceClaimed: false,
  commandSurfaceClaimed: false,
  uiChanged: false,
  docxImportClaimed: false,
  applyTxnImplemented: false,
  recoveryClaimed: false,
  startupRecoveryClaimed: false,
  releaseClaimed: false,
  multiSceneApplyClaimed: false,
  structuralApplyClaimed: false,
  commentApplyClaimed: false,
  networkUsed: false,
  dependencyChanged: false,
  userProjectMutated: false,
  realUserProjectPathTouched: false,
});

const OWNER_REQUIRED_TRUE_FIELDS = [
  'ownerApprovedContractShape',
  'ownerUnderstandsSchemaContractOnly',
  'ownerUnderstandsOwnerPacketNecessaryButInsufficient',
  'ownerUnderstandsNoPortImplementation',
  'ownerUnderstandsNoStoragePort',
  'ownerUnderstandsNoWritePort',
  'ownerUnderstandsNoPublicAdapterImplementation',
  'ownerUnderstandsNoRuntimeWiring',
  'ownerUnderstandsNoApplyExecution',
  'ownerUnderstandsNoApplyTxn',
  'ownerUnderstandsNoRecovery',
  'ownerUnderstandsNoUserProjectPath',
  'ownerUnderstandsNoReleaseClaim',
  'ownerPacketAuthorizesOnlyContractShape',
];

const OWNER_ALLOWED_FIELDS = Object.freeze(new Set([
  'packetKind',
  'targetContour',
  'bindingHeadSha',
  ...OWNER_REQUIRED_TRUE_FIELDS,
]));

const SHAPE_ALLOWED_FIELDS = Object.freeze(new Set([
  'shapeKind',
  'contourId',
  'schemaContractOnly',
  'privateInternalOnly',
  'exactTextOnly',
  'singleSceneOnly',
  'noPortImplementation',
  'noStoragePort',
  'noWritePort',
  'zeroWriteEffects',
  'writeEffectsCount',
  'ownerPacketNecessaryButInsufficient',
  'source002AResultHash',
  'source002ADecisionHash',
  'contractBriefHash',
  'failureContractHash',
  'requestSchema',
  'preconditionSchema',
  'futurePortCapabilitySchema',
  'successReceiptSchema',
  'failureResultSchema',
  'blockedReasonCodeSchema',
]));

const NESTED_SCHEMA_OVERRIDES = Object.freeze({
  requestSchemaOverrides: {
    outputKey: 'requestSchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'projectIdRequired',
      'sceneIdRequired',
      'baselineHashRequired',
      'sourceResultHashRequired',
      'sourceDecisionHashRequired',
      'sourceContractBriefHashRequired',
      'beforeSceneHashRequired',
      'expectedBlockVersionHashRequired',
      'closedSessionBlocked',
      'exactTextRequired',
      'exactBeforeTextRequired',
      'exactAfterTextRequired',
      'replacementTextRequired',
      'blockVersionHashRequired',
      'receiptNonceRequired',
      'requestedAtRequired',
      'userProjectPathAccepted',
      'callableFieldsAccepted',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'projectIdRequired',
      'sceneIdRequired',
      'baselineHashRequired',
      'sourceResultHashRequired',
      'sourceDecisionHashRequired',
      'sourceContractBriefHashRequired',
      'beforeSceneHashRequired',
      'expectedBlockVersionHashRequired',
      'closedSessionBlocked',
      'exactTextRequired',
      'exactBeforeTextRequired',
      'exactAfterTextRequired',
      'replacementTextRequired',
      'blockVersionHashRequired',
      'receiptNonceRequired',
      'requestedAtRequired',
      'zeroWriteEffects',
    ],
    falseFields: ['userProjectPathAccepted', 'callableFieldsAccepted'],
  },
  preconditionSchemaOverrides: {
    outputKey: 'preconditionSchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'projectIdTestRequired',
      'sceneIdTestRequired',
      'baselineHashTestRequired',
      'closedSessionBlockerRequired',
      'exactTextGuardRequired',
      'blockVersionHashTestRequired',
      'source002AResultHashRequired',
      'source002ADecisionHashRequired',
      'contractBriefHashRequired',
      'failureContractHashRequired',
      'sourceResultHashTestRequired',
      'sourceDecisionHashTestRequired',
      'contractBriefHashTestRequired',
      'noStructuralScopeTestRequired',
      'noCommentScopeTestRequired',
      'singleSceneScopeTestRequired',
      'inheritedChainRevalidationRequired',
      'ownerPacketNecessaryButInsufficient',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'projectIdTestRequired',
      'sceneIdTestRequired',
      'baselineHashTestRequired',
      'closedSessionBlockerRequired',
      'exactTextGuardRequired',
      'blockVersionHashTestRequired',
      'source002AResultHashRequired',
      'source002ADecisionHashRequired',
      'contractBriefHashRequired',
      'failureContractHashRequired',
      'sourceResultHashTestRequired',
      'sourceDecisionHashTestRequired',
      'contractBriefHashTestRequired',
      'noStructuralScopeTestRequired',
      'noCommentScopeTestRequired',
      'singleSceneScopeTestRequired',
      'inheritedChainRevalidationRequired',
      'ownerPacketNecessaryButInsufficient',
      'zeroWriteEffects',
    ],
    falseFields: [],
  },
  futurePortCapabilitySchemaOverrides: {
    outputKey: 'futurePortCapabilitySchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'capabilityDescriptorOnly',
      'canResolvePrivateRootRequired',
      'canRejectTraversalRequired',
      'canRejectSymlinkEscapeRequired',
      'canRejectDirectoryTargetRequired',
      'canReadSceneRequired',
      'canWriteBackupRequired',
      'canAtomicWriteSceneRequired',
      'canWriteReceiptRequired',
      'canReadBackReceiptRequired',
      'canReportFailureWithoutPartialSuccessRequired',
      'portImplementationAdmitted',
      'storagePortAdmitted',
      'writePortAdmitted',
      'callableFieldsAccepted',
      'applyExactTextWithReceipt',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'capabilityDescriptorOnly',
      'canResolvePrivateRootRequired',
      'canRejectTraversalRequired',
      'canRejectSymlinkEscapeRequired',
      'canRejectDirectoryTargetRequired',
      'canReadSceneRequired',
      'canWriteBackupRequired',
      'canAtomicWriteSceneRequired',
      'canWriteReceiptRequired',
      'canReadBackReceiptRequired',
      'canReportFailureWithoutPartialSuccessRequired',
      'zeroWriteEffects',
    ],
    falseFields: [
      'portImplementationAdmitted',
      'storagePortAdmitted',
      'writePortAdmitted',
      'callableFieldsAccepted',
    ],
  },
  successReceiptSchemaOverrides: {
    outputKey: 'successReceiptSchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'receiptKindRequired',
      'receiptVersionRequired',
      'contourIdRequired',
      'projectIdRequired',
      'sceneIdRequired',
      'source002BResultHashRequired',
      'source002BDecisionHashRequired',
      'beforeSceneHashRequired',
      'afterSceneHashRequired',
      'blockVersionHashRequired',
      'backupObservationHashRequired',
      'atomicWriteObservationHashRequired',
      'receiptCanonicalHashRequired',
      'sourceHashesRequired',
      'receiptIsNotRecovery',
      'receiptReadbackIsNotStartupRecovery',
      'atomicSingleFileWriteIsNotApplyTxn',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'receiptKindRequired',
      'receiptVersionRequired',
      'contourIdRequired',
      'projectIdRequired',
      'sceneIdRequired',
      'source002BResultHashRequired',
      'source002BDecisionHashRequired',
      'beforeSceneHashRequired',
      'afterSceneHashRequired',
      'blockVersionHashRequired',
      'backupObservationHashRequired',
      'atomicWriteObservationHashRequired',
      'receiptCanonicalHashRequired',
      'sourceHashesRequired',
      'receiptIsNotRecovery',
      'receiptReadbackIsNotStartupRecovery',
      'atomicSingleFileWriteIsNotApplyTxn',
      'zeroWriteEffects',
    ],
    falseFields: [],
  },
  failureResultSchemaOverrides: {
    outputKey: 'failureResultSchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'blockedReasonsRequired',
      'noReceiptOnBlockedPlan',
      'noBackupOnBlockedPlan',
      'noUserProjectMutation',
      'deterministicBlockedDecisionHash',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'blockedReasonsRequired',
      'noReceiptOnBlockedPlan',
      'noBackupOnBlockedPlan',
      'noUserProjectMutation',
      'deterministicBlockedDecisionHash',
      'zeroWriteEffects',
    ],
    falseFields: [],
  },
  blockedReasonCodeSchemaOverrides: {
    outputKey: 'blockedReasonCodeSchema',
    reason: 'NESTED_SCHEMA_UNKNOWN_FIELD_FORBIDDEN',
    allowed: new Set([
      'schemaKind',
      'codesRequired',
      'staleBaselineCodeRequired',
      'wrongProjectCodeRequired',
      'wrongSceneCodeRequired',
      'closedSessionCodeRequired',
      'exactTextGuardCodeRequired',
      'blockVersionHashMismatchCodeRequired',
      'sourceResultHashMismatchCodeRequired',
      'sourceDecisionHashMismatchCodeRequired',
      'contractBriefHashMismatchCodeRequired',
      'unsafePrivateRootCodeRequired',
      'pathTraversalCodeRequired',
      'symlinkEscapeCodeRequired',
      'directoryTargetCodeRequired',
      'targetCollisionCodeRequired',
      'multiSceneScopeCodeRequired',
      'structuralScopeCodeRequired',
      'commentScopeCodeRequired',
      'portCapabilityMissingCodeRequired',
      'portFailureCodeRequired',
      'readbackMismatchCodeRequired',
      'deterministicOrderingRequired',
      'zeroWriteEffects',
      'writeEffectsCount',
    ]),
    trueFields: [
      'codesRequired',
      'staleBaselineCodeRequired',
      'wrongProjectCodeRequired',
      'wrongSceneCodeRequired',
      'closedSessionCodeRequired',
      'exactTextGuardCodeRequired',
      'blockVersionHashMismatchCodeRequired',
      'sourceResultHashMismatchCodeRequired',
      'sourceDecisionHashMismatchCodeRequired',
      'contractBriefHashMismatchCodeRequired',
      'unsafePrivateRootCodeRequired',
      'pathTraversalCodeRequired',
      'symlinkEscapeCodeRequired',
      'directoryTargetCodeRequired',
      'targetCollisionCodeRequired',
      'multiSceneScopeCodeRequired',
      'structuralScopeCodeRequired',
      'commentScopeCodeRequired',
      'portCapabilityMissingCodeRequired',
      'portFailureCodeRequired',
      'readbackMismatchCodeRequired',
      'deterministicOrderingRequired',
      'zeroWriteEffects',
    ],
    falseFields: [],
  },
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function withoutHash(value, hashKey = 'canonicalHash') {
  if (!isObject(value)) {
    return value;
  }
  const { [hashKey]: _hash, ...rest } = value;
  return rest;
}

function withCanonicalHash(core) {
  return {
    ...core,
    canonicalHash: canonicalHash(core),
  };
}

function uniqueReasons(reasons) {
  return Array.from(new Set(reasons.filter(Boolean))).sort();
}

function resultCore(input) {
  return {
    resultKind: RESULT_KIND,
    contourId: TARGET_CONTOUR,
    schemaContractOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    zeroWriteEffects: true,
    writeEffectsCount: 0,
    ...FALSE_FLAGS,
    ...input,
  };
}

function buildContractShape(input) {
  const shape = {
    shapeKind: SHAPE_KIND,
    contourId: TARGET_CONTOUR,
    schemaContractOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    zeroWriteEffects: true,
    writeEffectsCount: 0,
    ownerPacketNecessaryButInsufficient: true,
    source002AResultHash: input.source002AResultHash,
    source002ADecisionHash: input.source002ADecisionHash,
    contractBriefHash: input.source002AResult?.contractBriefHash,
    failureContractHash: input.source002AResult?.failureContractHash,
    requestSchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_REQUEST_SCHEMA_002B',
      projectIdRequired: true,
      sceneIdRequired: true,
      baselineHashRequired: true,
      sourceResultHashRequired: true,
      sourceDecisionHashRequired: true,
      sourceContractBriefHashRequired: true,
      beforeSceneHashRequired: true,
      expectedBlockVersionHashRequired: true,
      closedSessionBlocked: true,
      exactTextRequired: true,
      exactBeforeTextRequired: true,
      exactAfterTextRequired: true,
      replacementTextRequired: true,
      blockVersionHashRequired: true,
      receiptNonceRequired: true,
      requestedAtRequired: true,
      userProjectPathAccepted: false,
      callableFieldsAccepted: false,
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.requestSchemaOverrides || {}),
    }),
    preconditionSchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_PRECONDITION_SCHEMA_002B',
      projectIdTestRequired: true,
      sceneIdTestRequired: true,
      baselineHashTestRequired: true,
      closedSessionBlockerRequired: true,
      exactTextGuardRequired: true,
      blockVersionHashTestRequired: true,
      source002AResultHashRequired: true,
      source002ADecisionHashRequired: true,
      contractBriefHashRequired: true,
      failureContractHashRequired: true,
      sourceResultHashTestRequired: true,
      sourceDecisionHashTestRequired: true,
      contractBriefHashTestRequired: true,
      noStructuralScopeTestRequired: true,
      noCommentScopeTestRequired: true,
      singleSceneScopeTestRequired: true,
      inheritedChainRevalidationRequired: true,
      ownerPacketNecessaryButInsufficient: true,
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.preconditionSchemaOverrides || {}),
    }),
    futurePortCapabilitySchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_FUTURE_PORT_CAPABILITY_SCHEMA_002B',
      capabilityDescriptorOnly: true,
      canResolvePrivateRootRequired: true,
      canRejectTraversalRequired: true,
      canRejectSymlinkEscapeRequired: true,
      canRejectDirectoryTargetRequired: true,
      canReadSceneRequired: true,
      canWriteBackupRequired: true,
      canAtomicWriteSceneRequired: true,
      canWriteReceiptRequired: true,
      canReadBackReceiptRequired: true,
      canReportFailureWithoutPartialSuccessRequired: true,
      portImplementationAdmitted: false,
      storagePortAdmitted: false,
      writePortAdmitted: false,
      callableFieldsAccepted: false,
      applyExactTextWithReceipt: 'FUTURE_CAPABILITY_DESCRIPTOR_ONLY',
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.futurePortCapabilitySchemaOverrides || {}),
    }),
    successReceiptSchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_SUCCESS_RECEIPT_SCHEMA_002B',
      receiptKindRequired: true,
      receiptVersionRequired: true,
      contourIdRequired: true,
      projectIdRequired: true,
      sceneIdRequired: true,
      source002BResultHashRequired: true,
      source002BDecisionHashRequired: true,
      beforeSceneHashRequired: true,
      afterSceneHashRequired: true,
      blockVersionHashRequired: true,
      backupObservationHashRequired: true,
      atomicWriteObservationHashRequired: true,
      receiptCanonicalHashRequired: true,
      sourceHashesRequired: true,
      receiptIsNotRecovery: true,
      receiptReadbackIsNotStartupRecovery: true,
      atomicSingleFileWriteIsNotApplyTxn: true,
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.successReceiptSchemaOverrides || {}),
    }),
    failureResultSchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_FAILURE_RESULT_SCHEMA_002B',
      blockedReasonsRequired: true,
      noReceiptOnBlockedPlan: true,
      noBackupOnBlockedPlan: true,
      noUserProjectMutation: true,
      deterministicBlockedDecisionHash: true,
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.failureResultSchemaOverrides || {}),
    }),
    blockedReasonCodeSchema: withCanonicalHash({
      schemaKind: 'PRIVATE_EXACT_TEXT_APPLY_BLOCKED_REASON_CODE_SCHEMA_002B',
      codesRequired: true,
      staleBaselineCodeRequired: true,
      wrongProjectCodeRequired: true,
      wrongSceneCodeRequired: true,
      closedSessionCodeRequired: true,
      exactTextGuardCodeRequired: true,
      blockVersionHashMismatchCodeRequired: true,
      sourceResultHashMismatchCodeRequired: true,
      sourceDecisionHashMismatchCodeRequired: true,
      contractBriefHashMismatchCodeRequired: true,
      unsafePrivateRootCodeRequired: true,
      pathTraversalCodeRequired: true,
      symlinkEscapeCodeRequired: true,
      directoryTargetCodeRequired: true,
      targetCollisionCodeRequired: true,
      multiSceneScopeCodeRequired: true,
      structuralScopeCodeRequired: true,
      commentScopeCodeRequired: true,
      portCapabilityMissingCodeRequired: true,
      portFailureCodeRequired: true,
      readbackMismatchCodeRequired: true,
      deterministicOrderingRequired: true,
      zeroWriteEffects: true,
      writeEffectsCount: 0,
      ...(input.blockedReasonCodeSchemaOverrides || {}),
    }),
    ...(input.contractShapeOverrides || {}),
  };
  return withCanonicalHash(shape);
}

function blockedResult(blockedReasons, observations = {}) {
  return withCanonicalHash(resultCore({
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B_BLOCKED',
    nextContourRecommendation: null,
    ownerMayOpen002C: false,
    ownerShapeAccepted: false,
    source002AAccepted: false,
    contractShape: null,
    contractShapeHash: null,
    exitPacket: {
      inheritedChainVerified: false,
      source002ARehashed: false,
      contractShapeEmitted: false,
      forbiddenClaimsBlocked: true,
      writeEffectsCount: 0,
      nextContour: null,
    },
    blockedReasons: uniqueReasons(blockedReasons),
    decisions: [],
    ...observations,
  }));
}

function acceptedResult(input) {
  const contractShape = buildContractShape(input);
  const decisionCore = {
    decisionKind: DECISION_KIND,
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_PORT_ADMISSION_002C_NO_PUBLIC_RUNTIME_ADMITTED',
    nextContourRecommendation: NEXT_CONTOUR,
    ownerShapeAccepted: true,
    source002AAccepted: true,
    schemaContractOnly: true,
    zeroWriteEffects: true,
    writeEffectsCount: 0,
    noPortImplementation: true,
    noStoragePort: true,
    noWritePort: true,
    publicRuntimeAdmitted: false,
    productApplyRuntimeAdmitted: false,
    publicAdapterImplementationAdmitted: false,
    runtimeWiringAdmitted: false,
    applyExecutionImplemented: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
  };
  const decision = withCanonicalHash(decisionCore);
  return withCanonicalHash(resultCore({
    outputDecision: decision.outputDecision,
    nextContourRecommendation: decision.nextContourRecommendation,
    ownerMayOpen002C: true,
    ownerShapeAccepted: true,
    source002AAccepted: true,
    source002AResultHash: input.source002AResultHash,
    source002ADecisionHash: input.source002ADecisionHash,
    contractBriefHash: input.source002AResult.contractBriefHash,
    failureContractHash: input.source002AResult.failureContractHash,
    contractShape,
    contractShapeHash: contractShape.canonicalHash,
    exitPacket: {
      inheritedChainVerified: true,
      source002ARehashed: true,
      contractShapeEmitted: true,
      forbiddenClaimsBlocked: true,
      writeEffectsCount: 0,
      nextContour: NEXT_CONTOUR,
    },
    blockedReasons: [],
    decisions: [decision],
  }));
}

function validateForbiddenClaims(value, reasons) {
  if (!isObject(value)) {
    return;
  }
  if (value.noPortImplementation === false || value.noStoragePort === false || value.noWritePort === false) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.portImplemented === true || value.storagePortImplemented === true || value.writePortImplemented === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (
    value.portImplementationAdmitted === true
    || value.storagePortAdmitted === true
    || value.writePortAdmitted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PORT_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.productApplyRuntimeAdmitted === true || value.publicRuntimeAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (value.publicAdapterImplementationAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN);
  }
  if (value.runtimeWiringAdmitted === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.RUNTIME_WIRING_FORBIDDEN);
  }
  if (
    value.applyExecutionRequested === true
    || value.applyExecutionImplemented === true
    || value.privateExactTextApplyWithReceiptExecuted === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.APPLY_EXECUTION_FORBIDDEN);
  }
  if (
    value.publicSurfaceClaimed === true
    || value.ipcSurfaceClaimed === true
    || value.preloadExportClaimed === true
    || value.menuSurfaceClaimed === true
    || value.commandSurfaceClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PUBLIC_COMMAND_SURFACE_FORBIDDEN);
  }
  if (value.uiChanged === true || value.docxImportClaimed === true || value.networkUsed === true || value.dependencyChanged === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN);
  }
  if (
    value.applyTxnImplemented === true
    || value.recoveryClaimed === true
    || value.startupRecoveryClaimed === true
    || value.releaseClaimed === true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.APPLYTXN_RECOVERY_RELEASE_FORBIDDEN);
  }
  if (value.userProjectMutated === true || value.realUserProjectPathTouched === true) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.USER_PROJECT_MUTATION_FORBIDDEN);
  }
}

function validateNoCallableOrPath(value, reasons, insideSource = false) {
  if (typeof value === 'function') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  for (const [field, nested] of Object.entries(value)) {
    if (!insideSource && /(?:^|_)?(?:userProjectPath|realUserProjectPath|projectPath|scenePath|filePath|absolutePath|filesystemPath)$/u.test(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN);
    }
    if (typeof nested === 'function') {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.CALLABLE_FIELD_FORBIDDEN);
    } else if (isObject(nested)) {
      validateNoCallableOrPath(nested, reasons, insideSource);
    }
  }
}

function validateSource002ADecision(source002A, input, reasons) {
  const decisions = Array.isArray(source002A.decisions) ? source002A.decisions : [];
  const decision = decisions[0] || null;
  if (decisions.length !== 1 || !isObject(decision)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_DECISION_MALFORMED);
    return;
  }
  if (
    decision.decisionKind !== SOURCE_002A_DECISION_KIND
    || decision.outputDecision !== source002A.outputDecision
    || decision.nextContourRecommendation !== source002A.nextContourRecommendation
    || decision.ownerMayOpen002B !== true
    || decision.contractBriefOnly !== true
    || decision.noPortImplementation !== true
    || decision.noStoragePort !== true
    || decision.noWritePort !== true
    || decision.writeEffectsCount !== 0
    || decision.publicRuntimeAdmitted !== false
    || decision.productApplyRuntimeAdmitted !== false
    || decision.publicAdapterImplementationAdmitted !== false
    || decision.runtimeWiringAdmitted !== false
    || decision.applyExecutionImplemented !== false
    || decision.applyTxnImplemented !== false
    || decision.recoveryClaimed !== false
    || decision.userProjectMutated !== false
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_DECISION_MALFORMED);
  }
  if (
    !hasText(decision.canonicalHash)
    || decision.canonicalHash !== canonicalHash(withoutHash(decision))
    || decision.canonicalHash !== input.source002ADecisionHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_DECISION_MISMATCH);
  }
}

function validateSource002AContracts(source002A, reasons) {
  const contractBrief = source002A.contractBrief;
  const failureContract = source002A.failureContract;
  if (
    !isObject(contractBrief)
    || contractBrief.briefKind !== SOURCE_002A_BRIEF_KIND
    || contractBrief.canonicalHash !== canonicalHash(withoutHash(contractBrief))
    || contractBrief.canonicalHash !== source002A.contractBriefHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_CONTRACT_BRIEF_MISMATCH);
  }
  if (
    !isObject(failureContract)
    || failureContract.canonicalHash !== canonicalHash(withoutHash(failureContract))
    || failureContract.canonicalHash !== source002A.failureContractHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_FAILURE_CONTRACT_MISMATCH);
  }
}

function validateSource002A(input, reasons) {
  const source002A = input.source002AResult;
  if (!isObject(source002A)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_RESULT_REQUIRED);
    return;
  }
  if (
    source002A.resultKind !== SOURCE_002A_RESULT_KIND
    || source002A.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_SHAPE_002B_NO_PUBLIC_RUNTIME_ADMITTED'
    || source002A.nextContourRecommendation !== TARGET_CONTOUR
    || source002A.ownerMayOpen002B !== true
    || source002A.source001ZAccepted !== true
    || source002A.contractBriefOnly !== true
    || source002A.noPortImplementation !== true
    || source002A.noStoragePort !== true
    || source002A.noWritePort !== true
    || source002A.writeEffectsCount !== 0
    || source002A.exitPacket?.writeEffectsCount !== 0
    || source002A.exitPacket?.inheritedChainVerified !== true
    || source002A.blockedReasons?.length
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_BLOCKED);
  }
  if (Object.entries(FALSE_FLAGS).some(([field, expected]) => source002A[field] !== expected)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.PRODUCT_RUNTIME_FORBIDDEN);
  }
  if (
    !hasText(source002A.canonicalHash)
    || source002A.canonicalHash !== canonicalHash(withoutHash(source002A))
    || source002A.canonicalHash !== input.source002AResultHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SOURCE_002A_RESULT_MISMATCH);
  }
  validateSource002ADecision(source002A, input, reasons);
  validateSource002AContracts(source002A, reasons);
}

function validateInheritedChain(input, reasons) {
  const rerun = runExactTextApplyWithReceiptPrivateContractBrief({
    source001ZResult: input.source001ZResult,
    source001ZResultHash: input.source002AResult?.source001ZResultHash,
    source001ZDecisionHash: input.source002AResult?.source001ZDecisionHash,
    source001YResult: input.source001YResult,
    source001XResult: input.source001XResult,
    source001WResult: input.source001WResult,
    source001VResult: input.source001VResult,
    source001UResult: input.source001UResult,
    ownerAdmissionPacket001Z: input.ownerAdmissionPacket001Z,
    ownerBriefPacket002A: input.ownerBriefPacket002A,
  });
  if (
    rerun.outputDecision !== 'OWNER_MAY_OPEN_PRIVATE_CONTRACT_SHAPE_002B_NO_PUBLIC_RUNTIME_ADMITTED'
    || rerun.canonicalHash !== input.source002AResultHash
    || rerun.decisions?.[0]?.canonicalHash !== input.source002ADecisionHash
    || rerun.contractBrief?.canonicalHash !== input.source002AResult?.contractBriefHash
    || rerun.failureContract?.canonicalHash !== input.source002AResult?.failureContractHash
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.INHERITED_CHAIN_REVALIDATION_FAILED);
  }
}

function validateOwnerPacket(input, reasons) {
  const packet = input.ownerShapePacket002B;
  if (!isObject(packet)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_PACKET_REQUIRED);
    return;
  }
  if (packet.packetKind !== OWNER_PACKET_KIND) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_PACKET_INVALID);
  }
  if (packet.targetContour !== NEXT_CONTOUR) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_PACKET_TARGET_MISMATCH);
  }
  for (const field of Object.keys(packet)) {
    if (!OWNER_ALLOWED_FIELDS.has(field)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN);
    }
  }
  if (packet.bindingHeadSha !== BINDING_HEAD_SHA) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_PACKET_BINDING_MISMATCH);
  }
  if (OWNER_REQUIRED_TRUE_FIELDS.some((field) => packet[field] !== true)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.OWNER_SHAPE_POLICY_MISSING);
  }
  validateForbiddenClaims(packet, reasons);
  validateNoCallableOrPath(packet, reasons);
}

function validateOverrides(input, reasons) {
  if (input.contractShapeOverrides !== undefined && !isObject(input.contractShapeOverrides)) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN);
  }
  if (isObject(input.contractShapeOverrides)) {
    validateNoCallableOrPath(input.contractShapeOverrides, reasons);
    validateForbiddenClaims(input.contractShapeOverrides, reasons);
    for (const field of Object.keys(input.contractShapeOverrides)) {
      if (!SHAPE_ALLOWED_FIELDS.has(field)) {
        reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_UNKNOWN_FIELD_FORBIDDEN);
      }
    }
  }
  for (const [overrideKey, config] of Object.entries(NESTED_SCHEMA_OVERRIDES)) {
    const overrides = input[overrideKey];
    if (overrides !== undefined && !isObject(overrides)) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_OVERRIDE_NON_OBJECT_FORBIDDEN);
    }
    if (isObject(overrides)) {
      validateNoCallableOrPath(overrides, reasons);
      validateForbiddenClaims(overrides, reasons);
      for (const field of Object.keys(overrides)) {
        if (!config.allowed.has(field)) {
          reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES[config.reason]);
        }
      }
    }
  }
}

function validateShapeFields(input, reasons) {
  const shape = buildContractShape(input);
  validateNoCallableOrPath(shape, reasons);
  validateForbiddenClaims(shape, reasons);
  if (
    shape.shapeKind !== SHAPE_KIND
    || shape.schemaContractOnly !== true
    || shape.privateInternalOnly !== true
    || shape.exactTextOnly !== true
    || shape.singleSceneOnly !== true
    || shape.noPortImplementation !== true
    || shape.noStoragePort !== true
    || shape.noWritePort !== true
    || shape.zeroWriteEffects !== true
    || shape.writeEffectsCount !== 0
    || shape.ownerPacketNecessaryButInsufficient !== true
  ) {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_SCHEMA_FIELD_MISSING);
  }
  for (const config of Object.values(NESTED_SCHEMA_OVERRIDES)) {
    const nested = shape[config.outputKey];
    if (!isObject(nested) || nested.writeEffectsCount !== 0) {
      reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_SCHEMA_FIELD_MISSING);
      continue;
    }
    for (const field of config.trueFields) {
      if (nested[field] !== true) {
        reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_SCHEMA_FIELD_MISSING);
      }
    }
    for (const field of config.falseFields) {
      if (nested[field] !== false) {
        reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_SCHEMA_FIELD_MISSING);
      }
    }
  }
  if (shape.futurePortCapabilitySchema?.applyExactTextWithReceipt !== 'FUTURE_CAPABILITY_DESCRIPTOR_ONLY') {
    reasons.push(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_REASON_CODES.SHAPE_SCHEMA_FIELD_MISSING);
  }
}

export function runExactTextApplyWithReceiptPrivateContractShape(input = {}) {
  const reasons = [];
  validateForbiddenClaims(input, reasons);
  validateSource002A(input, reasons);
  validateInheritedChain(input, reasons);
  validateOwnerPacket(input, reasons);
  validateOverrides(input, reasons);
  if (reasons.length === 0) {
    validateShapeFields(input, reasons);
  }
  if (reasons.length > 0) {
    return blockedResult(reasons, {
      source002AResultHash: input.source002AResultHash || input.source002AResult?.canonicalHash || null,
      source002ADecisionHash: input.source002ADecisionHash || null,
    });
  }
  return acceptedResult(input);
}
