from django.urls import path
from .ui_views import prod_dashboard, prod_ledger_partial, prod_portfolio_partial

urlpatterns = [
    path('', prod_dashboard, name='prod-dashboard'),
    path('partials/portfolio/', prod_portfolio_partial, name='prod-portfolio-partial'),
    path('partials/ledger/', prod_ledger_partial, name='prod-ledger-partial'),
]
