/**
 * 한국어 언어 팩
 * 애플리케이션의 모든 사용자 표시 텍스트를 포함
 */
export default {
  app: {
    title: '스니펫 관리자',
  },
  list: {
    searchPlaceholder: '스니펫 검색...',
    empty: '스니펫이 없습니다',
    emptyDesc: '위의 버튼을 클릭하여 첫 번째 스니펫을 만드세요',
  },
  form: {
    createTitle: '스니펫 만들기',
    editTitle: '스니펫 편집',
    createSubtitle: '아래 정보를 입력하여 새 스니펫을 만드세요',
    editSubtitle: '스니펫 내용과 속성을 수정하세요',
    name: '이름',
    namePlaceholder: '스니펫 이름 입력',
    prefix: '접두사',
    prefixPlaceholder: '트리거 접두사 입력 (예: log)',
    body: '코드 내용',
    bodyPlaceholder: '코드 내용 입력 ($1, $2, $0 탭스톱 지원)',
    bodyHint: '$1, $2, $0 탭스톱 지원',
    description: '설명',
    descriptionPlaceholder: '스니펫 설명 입력',
    language: '대상 언어',
    languagePlaceholder: '대상 언어 선택',
    allLanguages: '모든 언어',
    save: '저장',
    cancel: '취소',
    nameRequired: '이름을 입력하세요',
    prefixRequired: '접두사를 입력하세요',
    bodyRequired: '코드 내용을 입력하세요',
  },
  delete: {
    title: '삭제 확인',
    content: '스니펫 "{name}"을(를) 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
    confirm: '삭제',
    cancel: '취소',
  },
  filter: {
    all: '전체',
    label: '언어 필터',
  },
  actions: {
    create: '새 스니펫',
    edit: '편집',
    delete: '삭제',
  },
  importExport: {
    exportConfig: '내보내기',
    importConfig: '가져오기',
    exportConfirmTitle: '내보내기 확인',
    exportConfirmContent: '모든 스니펫을 내보내시겠습니까?',
    importConfirmTitle: '가져오기 확인',
    importConfirmContent: '스니펫을 가져오시겠습니까? 이 작업은 취소할 수 없습니다.',
    exportSuccess: '내보내기 성공!',
    exportFailed: '내보내기 실패',
    importSuccess: '가져오기 성공! {count}개의 스니펫을 가져왔습니다.',
    importFailed: '가져오기 실패',
    importPartial: '{imported}개를 가져왔고, {errors}개에서 오류가 발생했습니다.',
    noDataToExport: '내보낼 데이터가 없습니다',
  },
  sort: {
    newestFirst: '최신순',
    oldestFirst: '오래된순',
  },
  lang: {
    name: '한국어',
  },
  error: {
    generic: '작업에 실패했습니다. 다시 시도해 주세요',
  },
}
