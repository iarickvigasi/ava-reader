# Production deployment

- `.github/workflows/deploy.yml` allows 30m for the SSH command. Before pulls/builds it checks
  the checkout, `/tmp`, Docker's data directory, and the attached volume for 2 GiB and 10000
  free inodes each,
  and logs filesystem/Docker usage. It warns below 5 GiB. These initial thresholds do not
  guarantee build capacity; peak build disk usage remains unmeasured.
- Before building and on shell exit (including failure), cleanup removes build cache unused for
  24h with a 5GB cache retention target, plus dangling images older than 24h. Each prune has a 60s limit;
  cleanup warnings preserve the deployment exit status. Volumes are never pruned. A hard kill
  cannot run the exit trap; the next deployment repeats cleanup before checking storage.
