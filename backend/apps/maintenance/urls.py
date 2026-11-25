from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import MaintenanceTicketViewSet

router = DefaultRouter()
router.register('tickets', MaintenanceTicketViewSet, basename='maintenance-tickets')

urlpatterns = [
    path('', include(router.urls)),
]
