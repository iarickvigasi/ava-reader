CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Work_originalTitle_trgm" ON "Work" USING GIN ("originalTitle" gin_trgm_ops);
CREATE INDEX "WorkText_title_trgm" ON "WorkText" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Author_displayName_trgm" ON "Author" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "AuthorAlias_name_trgm" ON "AuthorAlias" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Edition_title_trgm" ON "Edition" USING GIN ("title" gin_trgm_ops);
