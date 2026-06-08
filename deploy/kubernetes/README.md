# Holmes UI Kubernetes Deployment

This bundle deploys MongoDB, the Holmes UI API, and the Holmes UI web frontend.

## Before Applying

Edit these values first:

- `api.yaml`: replace `ghcr.io/your-org/holmes-ui-api:latest`.
- `web.yaml`: replace `ghcr.io/your-org/holmes-ui-web:latest`.
- `api-configmap.yaml`: set `CORS_ORIGIN` to the public HTTPS URL of the web app.
- `api-configmap.yaml`: set `HOLMES_API_URL` and OIDC values if needed.
- `api-secret.yaml`: set `APP_SECRET`, `ADMIN_PASSWORD`, tokens, and `HOLMES_API_KEY` if needed.
- `mongo-secret.yaml`: set `MONGO_INITDB_ROOT_PASSWORD`.
- `ingress.yaml` or `../openshift/route.yaml`: set the public hostname.

`APP_SECRET` must remain stable across pod restarts and redeploys because it signs login sessions and encrypts stored secrets.
Use a URL-safe Mongo password, or percent-encode special characters before putting them into the MongoDB URI.
If your images are in a private registry, add `imagePullSecrets` to the `api` and `web` deployments.

## Build And Push Images

```bash
docker build -t <registry>/holmes-ui-api:<tag> -f apps/api/Dockerfile .
docker build -t <registry>/holmes-ui-web:<tag> -f apps/web/Dockerfile .
docker push <registry>/holmes-ui-api:<tag>
docker push <registry>/holmes-ui-web:<tag>
```

Then update the image names in `api.yaml` and `web.yaml`.

## Deploy

```bash
kubectl apply -k deploy/kubernetes
```

For standard Kubernetes ingress:

```bash
kubectl apply -f deploy/kubernetes/ingress.yaml
```

The ingress manifest expects an existing TLS secret named `holmes-ui-tls`. Adjust the secret name, add cert-manager annotations, or replace it with your cluster's normal TLS pattern.

For OpenShift, use the OpenShift overlay instead:

```bash
oc apply -k deploy/openshift
```

## Verify

```bash
kubectl -n holmes-ui get pods
kubectl -n holmes-ui logs deploy/api
kubectl -n holmes-ui port-forward svc/web 8080:80
curl http://localhost:8080/api/health
```

Then open the public HTTPS hostname and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Notes

- Only the `web` service should be exposed publicly. The web container proxies `/api` to the internal `api` service on port `8765`.
- Production cookies are marked `Secure`, so the public route should use HTTPS.
- `ADMIN_PASSWORD` only creates the first admin if the database has no admin user yet.
- MongoDB credentials are only initialized on an empty Mongo data volume.
