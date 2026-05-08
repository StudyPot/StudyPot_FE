<script setup lang="ts">
type WorkflowItem = {
  title: string
  description: string
  status: string
}

const valueProps = [
  '그룹 생성부터 초대까지 한 번에',
  '온보딩 응답 기반 AI 커리큘럼 시작',
  '주차별 todo와 회고 흐름까지 연결',
]

const workflowItems: WorkflowItem[] = [
  {
    title: '그룹 생성',
    description: '스터디 주제와 기간을 정리하고 멤버를 초대해요.',
    status: '시작 준비',
  },
  {
    title: '온보딩 수집',
    description: '실력, 선호도, 가능 시간을 받아 팀의 출발점을 맞춰요.',
    status: '자동 정리',
  },
  {
    title: 'AI 운영 시작',
    description: '주차별 todo와 회고 피드백으로 학습 리듬을 이어가요.',
    status: 'Google 로그인 후 이용',
  },
]
</script>

<template>
  <main class="relative min-h-screen overflow-hidden px-6 py-8 lg:px-10 lg:py-10">
    <div
      class="pointer-events-none absolute inset-x-8 top-0 h-56 rounded-full bg-[rgba(54,92,255,0.12)] blur-3xl"
    />
    <div
      class="pointer-events-none absolute -right-10 top-24 h-80 w-80 rounded-full bg-[rgba(152,168,255,0.18)] blur-3xl"
    />

    <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center">
      <div class="mt-6 rounded-[30px] border border-[var(--color-line)] bg-white p-5 sm:p-6">
        <div class="flex items-center gap-3">
          <div>
            <p class="text-base font-semibold text-[var(--color-ink)]">Google 계정으로 로그인</p>
          </div>
        </div>

        <button
          type="button"
          class="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--color-primary)] px-5 py-4 text-base font-semibold text-white transition hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-4 focus:ring-[rgba(54,92,255,0.2)]"
        >
          <svg
            aria-hidden="true"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.64 12.2045C21.64 11.5668 21.5827 10.9536 21.4764 10.3636H12V14.2577H17.4145C17.1814 15.5159 16.4723 16.5818 15.4064 17.2927V19.8182H18.6618C20.5673 18.0636 21.64 15.4773 21.64 12.2045Z"
              fill="#4285F4"
            />
            <path
              d="M12 22C14.72 22 17.0018 21.0982 18.6618 19.8182L15.4064 17.2927C14.5045 17.8982 13.3509 18.2577 12 18.2577C9.37636 18.2577 7.15273 16.4855 6.36 14.1027H2.99455V16.7109C4.64545 19.9891 8.03818 22 12 22Z"
              fill="#34A853"
            />
            <path
              d="M6.36 14.1027C6.15818 13.4973 6.04364 12.8509 6.04364 12.1818C6.04364 11.5127 6.15818 10.8664 6.36 10.2609V7.65273H2.99455C2.31545 9.00545 1.93091 10.5291 1.93091 12.1818C1.93091 13.8345 2.31545 15.3582 2.99455 16.7109L6.36 14.1027Z"
              fill="#FBBC05"
            />
            <path
              d="M12 6.10545C13.4745 6.10545 14.7982 6.61273 15.84 7.60909L18.7355 4.71364C16.9973 3.06091 14.7155 2 12 2C8.03818 2 4.64545 4.01091 2.99455 7.28909L6.36 9.89727C7.15273 7.51455 9.37636 5.74227 12 5.74227V6.10545Z"
              fill="#EA4335"
            />
          </svg>
          Google로 시작하기
        </button>
      </div>
    </div>
  </main>
</template>
