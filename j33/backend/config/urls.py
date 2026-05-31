from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include([
        path('auth/', include('apps.accounts.urls')),
        path('files/', include('apps.files.urls')),
        path('browser/', include('apps.browser.urls')),
        path('annotation/', include('apps.annotation.urls')),
        path('prediction/', include('apps.prediction.urls')),
        path('tasks/', include('apps.tasks.urls')),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
