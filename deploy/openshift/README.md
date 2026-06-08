# Holmes UI OpenShift Deployment

This overlay deploys the Kubernetes base plus an OpenShift Route.

## Edit First

- `deploy/kubernetes/api.yaml`: confirm the API image, default `ghcr.io/hoangnam-study/aiops-holmes-web-api:main`.
- `deploy/kubernetes/web.yaml`: confirm the web image, default `ghcr.io/hoangnam-study/aiops-holmes-web:main`.
- `deploy/kubernetes/api-configmap.yaml`: set `CORS_ORIGIN` to `https://<route-host>`.
- `deploy/kubernetes/api-configmap.yaml`: set `HOLMES_API_URL`.
- `deploy/kubernetes/api-secret.yaml`: set `APP_SECRET`, `ADMIN_PASSWORD`, and optional tokens.
- `deploy/kubernetes/mongo-secret.yaml`: set `MONGO_INITDB_ROOT_PASSWORD`.
- `deploy/openshift/route.yaml`: set `spec.host`.

## Build And Push

Pushing to `main` runs `.github/workflows/build-images.yml` and publishes:

- `ghcr.io/hoangnam-study/aiops-holmes-web-api:main`
- `ghcr.io/hoangnam-study/aiops-holmes-web:main`

To build manually instead:

```bash
docker build -t ghcr.io/hoangnam-study/aiops-holmes-web-api:main -f apps/api/Dockerfile .
docker build -t ghcr.io/hoangnam-study/aiops-holmes-web:main -f apps/web/Dockerfile .
docker push ghcr.io/hoangnam-study/aiops-holmes-web-api:main
docker push ghcr.io/hoangnam-study/aiops-holmes-web:main
```

## Apply

```bash
oc apply -k deploy/openshift
```

If the GHCR packages are private, create and attach an image pull secret first:

```bash
oc -n obs-holmes-ui create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token-with-read-packages>
oc -n obs-holmes-ui secrets link default ghcr-pull-secret --for=pull
```

## Verify

```bash
oc -n obs-holmes-ui get pods
oc -n obs-holmes-ui get route holmes-ui
oc -n obs-holmes-ui logs deploy/api
oc -n obs-holmes-ui port-forward svc/web 8080:80
curl http://localhost:8080/api/health
```

Open the Route URL over HTTPS and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## OpenShift Notes

- The web container listens on unprivileged port `8080`, while the service still exposes port `80`.
- The Route uses edge TLS and redirects HTTP to HTTPS, which is required for production login cookies.
- `HOLMES_API_URL` points at the internal Holmes service DNS name so API pods do not depend on external Route DNS from inside the cluster.
- If the GHCR packages are private, create an OpenShift image pull secret and attach it to the `default` service account in the `obs-holmes-ui` namespace.
- The included MongoDB StatefulSet is useful for a simple self-contained install. For production, prefer your platform MongoDB/operator and point `MONGODB_URI` at that service.
- MongoDB credentials are initialized only when the Mongo data PVC is empty.
- The Mongo image is fully qualified as `docker.io/library/mongo:8` so OpenShift does not resolve the short name through a private registry search path.
