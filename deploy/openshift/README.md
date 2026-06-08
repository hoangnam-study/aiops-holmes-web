# Holmes UI OpenShift Deployment

This overlay deploys the Kubernetes base plus an OpenShift Route.

## Edit First

- `deploy/kubernetes/api.yaml`: set the API image.
- `deploy/kubernetes/web.yaml`: set the web image.
- `deploy/kubernetes/api-configmap.yaml`: set `CORS_ORIGIN` to `https://<route-host>`.
- `deploy/kubernetes/api-configmap.yaml`: set `HOLMES_API_URL`.
- `deploy/kubernetes/api-secret.yaml`: set `APP_SECRET`, `ADMIN_PASSWORD`, and optional tokens.
- `deploy/kubernetes/mongo-secret.yaml`: set `MONGO_INITDB_ROOT_PASSWORD`.
- `deploy/openshift/route.yaml`: set `spec.host`.

## Build And Push

Push both images to a registry OpenShift can pull:

```bash
docker build -t <registry>/holmes-ui-api:<tag> -f apps/api/Dockerfile .
docker build -t <registry>/holmes-ui-web:<tag> -f apps/web/Dockerfile .
docker push <registry>/holmes-ui-api:<tag>
docker push <registry>/holmes-ui-web:<tag>
```

## Apply

```bash
oc apply -k deploy/openshift
```

## Verify

```bash
oc -n holmes-ui get pods
oc -n holmes-ui get route holmes-ui
oc -n holmes-ui logs deploy/api
oc -n holmes-ui port-forward svc/web 8080:80
curl http://localhost:8080/api/health
```

Open the Route URL over HTTPS and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## OpenShift Notes

- The web container listens on unprivileged port `8080`, while the service still exposes port `80`.
- The Route uses edge TLS and redirects HTTP to HTTPS, which is required for production login cookies.
- The included MongoDB StatefulSet is useful for a simple self-contained install. For production, prefer your platform MongoDB/operator and point `MONGODB_URI` at that service.
- MongoDB credentials are initialized only when the Mongo data PVC is empty.
