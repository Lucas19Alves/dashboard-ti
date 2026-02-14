<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-home text-3xl text-blue-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Início</h1>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Card Auditorias -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Auditorias</p>
            <p class="text-3xl font-bold text-gray-800">12</p>
          </div>
          <i class="fas fa-search text-4xl text-blue-500 opacity-20"></i>
        </div>
      </div>

      <!-- Card Sistemas -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Sistemas</p>
            <p class="text-3xl font-bold text-gray-800">8</p>
          </div>
          <i class="fas fa-server text-4xl text-green-500 opacity-20"></i>
        </div>
      </div>

      <!-- Card Vencimentos -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Vencimentos</p>
            <p class="text-3xl font-bold text-gray-800">5</p>
          </div>
          <i class="fas fa-calendar-alt text-4xl text-orange-500 opacity-20"></i>
        </div>
      </div>

      <!-- Card Total -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Total</p>
            <p class="text-3xl font-bold text-gray-800">25</p>
          </div>
          <i class="fas fa-chart-line text-4xl text-purple-500 opacity-20"></i>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Resumo de Atividades</h2>
      <div class="bg-white rounded-lg shadow-lg p-6">
        <p class="text-gray-600">Bem-vindo ao Dashboard TI. Utilize o menu para acessar as diferentes seções.</p>
      </div>
    </div>
  </div>
</template>
