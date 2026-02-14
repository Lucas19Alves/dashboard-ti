<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-calendar-alt text-3xl text-orange-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Vencimentos</h1>
    </div>

    <div class="grid grid-cols-1 gap-6">
      <!-- Próximos Vencimentos -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Próximos Vencimentos</h2>
        
        <div class="space-y-4">
          <!-- Item 1 -->
          <div class="flex items-center justify-between p-4 border-l-4 border-red-500 bg-red-50 rounded">
            <div>
              <h3 class="font-bold text-gray-800">Licença - Microsoft Office</h3>
              <p class="text-sm text-gray-600">Vence em 12 dias</p>
            </div>
            <span class="bg-red-500 text-white px-4 py-2 rounded font-bold">26/02/2026</span>
          </div>

          <!-- Item 2 -->
          <div class="flex items-center justify-between p-4 border-l-4 border-orange-500 bg-orange-50 rounded">
            <div>
              <h3 class="font-bold text-gray-800">Antivírus Enterprise</h3>
              <p class="text-sm text-gray-600">Vence em 25 dias</p>
            </div>
            <span class="bg-orange-500 text-white px-4 py-2 rounded font-bold">11/03/2026</span>
          </div>

          <!-- Item 3 -->
          <div class="flex items-center justify-between p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded">
            <div>
              <h3 class="font-bold text-gray-800">VPN Premium - 5 Usuários</h3>
              <p class="text-sm text-gray-600">Vence em 45 dias</p>
            </div>
            <span class="bg-yellow-500 text-white px-4 py-2 rounded font-bold">31/03/2026</span>
          </div>

          <!-- Item 4 -->
          <div class="flex items-center justify-between p-4 border-l-4 border-green-500 bg-green-50 rounded">
            <div>
              <h3 class="font-bold text-gray-800">Suporte Técnico - AWS</h3>
              <p class="text-sm text-gray-600">Vence em 60 dias</p>
            </div>
            <span class="bg-green-500 text-white px-4 py-2 rounded font-bold">15/04/2026</span>
          </div>
        </div>
      </div>

      <!-- Resumo -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-red-50 rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Vencendo em Breve</p>
              <p class="text-3xl font-bold text-red-600">2</p>
            </div>
            <i class="fas fa-clock text-red-600 text-4xl opacity-20"></i>
          </div>
        </div>

        <div class="bg-yellow-50 rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Atenção</p>
              <p class="text-3xl font-bold text-yellow-600">1</p>
            </div>
            <i class="fas fa-exclamation-triangle text-yellow-600 text-4xl opacity-20"></i>
          </div>
        </div>

        <div class="bg-green-50 rounded-lg shadow-lg p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Em Dia</p>
              <p class="text-3xl font-bold text-green-600">1</p>
            </div>
            <i class="fas fa-check-circle text-green-600 text-4xl opacity-20"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
